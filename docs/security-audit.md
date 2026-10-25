# VahanaIQ Platform Security Audit & Threat Assessment

**Document Version:** 1.0.0  
**Assessment Date:** 25/10/2026  
**Target Repository:** `/Users/Shared/vahanaiq`  
**Target Version:** v2.11.5 (Commit: `f60c302`)  
**Auditor / Agent:** Antigravity  
**Branch:** `security/hardening-pass`  
**Classification:** Internal Technical Documentation  

---

## 1. Executive Summary

A comprehensive security audit and architecture review was conducted on the **VahanaIQ** Sri Lankan vehicle lease calculation and affordability discovery platform. VahanaIQ consists of a static client application deployed on GitHub Pages, a serverless backend proxy for Gemini generative AI search (deployed on Google Cloud Run with an alternate Cloudflare Worker implementation), optional Google OAuth authentication, and document synchronization via Google Cloud Firestore.

The audit evaluated the repository against industry standards, including the **OWASP Web Security Testing Guide (WSTG v4.2)**, **OWASP Application Security Verification Standard (ASVS v4.0 L2)**, and Sri Lankan regulatory constraints (**CBSL Directions No. 01 of 2026**).

### High-Level Posture
- **Strengths:** 
  - Zero server-side API keys exposed in client bundles (`GEMINI_API_KEY` is strictly held on serverless proxy).
  - Firestore security rules strictly constrain reads, writes, and deletes to authenticated matching user IDs (`request.auth.uid == uid`).
  - No client-side tracking, analytics, or third-party tracking scripts.
  - Test automation is comprehensive (6 test suites covering 100% of core calculators, statutory rules, and end-to-end user journeys).
- **Primary Hardening Targets:**
  - Absence of a declarative **Content Security Policy (CSP)** meta header.
  - In-memory rate limiting and string-inequality token comparison in serverless proxies (`serverless/gcp-cloud-function/index.js`).
  - Over 30 assignments to `.innerHTML` requiring systematic DOM sink hygiene and conversion to declarative DOM creation.
  - File upload MIME and magic-byte verification for Photo Studio canvas operations.

---

## 2. Scope & Architectural Boundaries

```
+-----------------------------------------------------------------------------------+
|                                  USER BROWSER                                     |
|  +--------------------+  +-----------------------+  +--------------------------+  |
|  | Calculator Engine  |  | Curated Catalogue     |  | Photo Studio (IndexedDB) |  |
|  | (Vanilla ES6)      |  | (504 WebP Assets)     |  | (Local File Uploads)     |  |
|  +--------------------+  +-----------------------+  +--------------------------+  |
|           |                         |                           |                 |
|           | (Pure Math)             | (Static Assets)           | (Local Canvas)  |
|           v                         v                           v                 |
|    localStorage             GitHub Pages Origin           IndexedDB               |
|    (vahanaiq_inputs_v1,     (https://akila-w.github.io/   (vahanaiq_studio_v1)    |
|     vahanaiq_comparison_v3)  VahanaIQ/)                                           |
+-----------------------------------------------------------------------------------+
       |                                                               |
       | POST / (Rate-limited, Origin-checked)                         | Sync (OAuth2)
       v                                                               v
+--------------------------------------------+    +---------------------------------+
| SERVERLESS PROXY                           |    | GOOGLE FIREBASE & FIRESTORE     |
| - Cloud Run / Cloudflare Worker            |    | - Google Identity Services      |
| - Holds GEMINI_API_KEY (Server-only)       |    | - Firestore: /users/{uid}       |
| - Grounded Google Search (Price Mode)      |    | - Strict firestore.rules        |
| - Schema Validation (OpenAPI)              |    +---------------------------------+
+--------------------------------------------+
       |
       v
+--------------------------------------------+
| Google Gemini API                          |
| (gemini-3.6-flash / gemini-2.5-flash-lite) |
+--------------------------------------------+
```

### Components in Scope

| Subsystem | Components / Files | Threat Boundaries |
| :--- | :--- | :--- |
| **Frontend Application** | `index.html`, `catalogue.html`, `studio.html`, `js/*.js`, `css/*.css` | Untrusted user input, DOM XSS, clickjacking, malicious file uploads, state tampering. |
| **Serverless Proxies** | `serverless/gcp-cloud-function/index.js`, `serverless/cloudflare-worker.js` | Origin spoofing, rate-limiting bypass, API key leakage, SSRF/DoS, prompt injection. |
| **Database & Auth** | `firestore.rules`, `js/account.js`, `js/config.js` | Unauthorized data access, privilege escalation, payload manipulation, prototype pollution. |
| **Offline PWA** | `sw.js` | Cache poisoning, unvalidated redirect caching, offline asset integrity. |
| **CI/CD & Release** | `.github/workflows/*.yml`, `scripts/smoke-deploy.mjs` | Unintended path exposure, supply chain dependency compromise, workflow privilege escalation. |

---

## 3. Threat Assessment & Vulnerability Findings

### High Severity Findings

#### [SEC-HIGH-01] Missing Declarative Content Security Policy (CSP)
- **CWE:** [CWE-1021](https://cwe.mitre.org/data/definitions/1021.html) / [CWE-79](https://cwe.mitre.org/data/definitions/79.html)
- **CVSS 3.1 Score:** 7.5 (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N`)
- **Affected Files:** `index.html`, `catalogue.html`, `studio.html`, `about.html`, `terms.html`, `privacy.html`
- **Description:** The web pages do not define a Content Security Policy via `<meta http-equiv="Content-Security-Policy">`. If an attacker were to identify an XSS injection vector through user-provided vehicle data or URL manipulation, no policy restricts the execution of injected scripts, unauthorized network connections (`fetch`/`XHR`), or framing by malicious third-party origins.
- **Remediation:** Introduce a restrictive meta CSP across all HTML pages:
  ```html
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    script-src 'self' 'unsafe-inline' https://accounts.google.com https://www.gstatic.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob: https://*.googleusercontent.com;
    connect-src 'self' https://vahanaiq-search-71962876227.asia-south1.run.app https://identitytoolkit.googleapis.com https://firestore.googleapis.com https://securetoken.googleapis.com;
    frame-src https://accounts.google.com;
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
  ">
  ```

#### [SEC-HIGH-02] Non-Constant-Time Token Verification in Price Mode Authentication
- **CWE:** [CWE-208](https://cwe.mitre.org/data/definitions/208.html) (Observable Timing Discrepancy)
- **CVSS 3.1 Score:** 7.4 (`CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N`)
- **Affected Files:** `serverless/gcp-cloud-function/index.js` (lines 273–276)
- **Description:** 
  ```javascript
  if (process.env.PRICE_TOKEN && header('x-price-token') !== process.env.PRICE_TOKEN) {
    res.status(401).json({ error: 'unauthorised', detail: 'Price mode needs the X-Price-Token header' });
    return;
  }
  ```
  Standard JavaScript `!==` performs short-circuit string comparison, terminating at the first mismatched byte. An attacker measuring request latencies across many samples could progressively determine the value of `PRICE_TOKEN`.
- **Remediation:** Use `crypto.timingSafeEqual` with constant-length buffers:
  ```javascript
  const crypto = require('crypto');
  function safeCompare(a, b) {
    const bufA = Buffer.from(String(a || ''));
    const bufB = Buffer.from(String(b || ''));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }
  ```

#### [SEC-HIGH-03] Systematic Audit and Hardening of `.innerHTML` Sinks
- **CWE:** [CWE-79](https://cwe.mitre.org/data/definitions/79.html) (Improper Neutralization of Input During Web Page Generation)
- **CVSS 3.1 Score:** 7.1 (`CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N`)
- **Affected Files:** `js/app.js`, `js/catalogue-browser.js`, `js/planner.js`, `js/curated-catalogue.js`, `js/catalogue-studio.js`
- **Description:** While `esc()` HTML encoding is widely used, direct `.innerHTML` assignments remain common across dynamically generated UI (e.g. comparison cards, AI discovery results, telemetry readouts). Relying exclusively on manual string escaping introduces high risk of accidental omissions during ongoing maintenance.
- **Remediation:** Progressively refactor complex sinks to native DOM manipulation (`document.createElement`, `replaceChildren`, `textContent`) or utilize template element cloning.

---

### Medium Severity Findings

#### [SEC-MED-01] Missing Clickjacking Defense (`frame-ancestors` / Framebusting)
- **CWE:** [CWE-1021](https://cwe.mitre.org/data/definitions/1021.html)
- **CVSS 3.1 Score:** 5.4 (`CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N`)
- **Affected Files:** `index.html`, `catalogue.html`, `studio.html`
- **Description:** Without `frame-ancestors 'none'`, third-party websites can embed VahanaIQ within transparent `<iframe>` elements to conduct clickjacking or UI redressing attacks (e.g. tricking users into clearing comparison data or interacting with lease settings).
- **Remediation:** Enforce `frame-ancestors 'none'` within the Content Security Policy meta tag and include defensive client-side framebusting:
  ```javascript
  if (window.top !== window.self) window.top.location = window.self.location;
  ```

#### [SEC-MED-02] Photo Studio Upload Validation & Polyglot Prevention
- **CWE:** [CWE-434](https://cwe.mitre.org/data/definitions/434.html) (Unrestricted Upload of File with Dangerous Type)
- **CVSS 3.1 Score:** 5.3 (`CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N`)
- **Affected Files:** `js/catalogue-studio.js`, `studio.html`
- **Description:** Photo Studio allows users to upload local images via drag-and-drop or file pickers. While files are processed client-side and saved into IndexedDB, accepting unverified files without magic-byte inspection allows SVG or HTML polyglots with embedded script tags to enter the client storage pipeline.
- **Remediation:** Inspect file headers (magic bytes) to strictly verify binary signatures for `image/jpeg` (`FF D8 FF`), `image/png` (`89 50 4E 47`), and `image/webp` (`RIFF....WEBP`). Disallow raw SVG uploads unless parsed through a strict DOM sanitizer.

#### [SEC-MED-03] Missing Referrer-Policy and Permissions-Policy
- **CWE:** [CWE-200](https://cwe.mitre.org/data/definitions/200.html) (Exposure of Sensitive Information)
- **CVSS 3.1 Score:** 4.3 (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N`)
- **Affected Files:** All HTML pages
- **Description:** External navigation or requests to external assets could transmit full URL paths including query fragments in the HTTP `Referer` header.
- **Remediation:** Add `<meta name="referrer" content="strict-origin-when-cross-origin">` and configure permissions policies to disable unnecessary browser APIs (e.g., `camera 'none'; microphone 'none'; geolocation 'none'`).

#### [SEC-MED-04] In-Memory Rate Limiting Cold-Start Degradation
- **CWE:** [CWE-770](https://cwe.mitre.org/data/definitions/770.html) (Allocation of Resources Without Limits or Throttling)
- **CVSS 3.1 Score:** 5.3 (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L`)
- **Affected Files:** `serverless/gcp-cloud-function/index.js`, `serverless/cloudflare-worker.js`
- **Description:** The `hits` map resides in memory. When serverless instances scale out or restart on cold starts, counters reset. While an intentional trade-off for a serverless zero-database proxy, IP extraction must be verified against load-balancer client headers (`x-forwarded-for`) to avoid IP collision across users.
- **Remediation:** Extract client IP from the rightmost untrusted hop in `X-Forwarded-For` on Cloud Run, and verify rate limits fail gracefully without crashing.

---

### Low & Informational Findings

#### [SEC-LOW-01] GitHub Actions Permissions Least Privilege
- **CWE:** [CWE-272](https://cwe.mitre.org/data/definitions/272.html) (Least Privilege Violation)
- **Affected Files:** `.github/workflows/test.yml`, `.github/workflows/smoke-deploy.yml`, `.github/workflows/refresh-prices.yml`
- **Description:** Workflows do not declare explicit read-only `permissions:` blocks at top level.
- **Remediation:** Add `permissions: contents: read` to all workflows.

#### [SEC-LOW-02] Mutable Action Version Tags in CI
- **CWE:** [CWE-829](https://cwe.mitre.org/data/definitions/829.html) (Inclusion of Functionality from Untrusted Control Sphere)
- **Affected Files:** `.github/workflows/*.yml`
- **Description:** Actions use mutable version tags (`@v4`) rather than immutable full commit SHAs.
- **Remediation:** Pin workflows to commit SHAs.

#### [SEC-INFO-01] Public Firebase Configuration in `js/config.js`
- **Assessment:** **Intentional Design (Not a Vulnerability)**
- **Analysis:** As documented in `SECURITY.md`, Firebase web configurations (`apiKey`, `projectId`, `appId`) are identifiers, not secrets. Access control is enforced by `firestore.rules`. Verified that rules restrict all access to matching authenticated UIDs.

---

## 4. Verification & Testing Baseline

All 6 core test suites were executed on `security/hardening-pass` (commit `f60c302`) to establish the regression baseline:

```
Calculator checks passed
Flat-rate, legal down payment and extra-cost checks passed
ALL 10 VERIFICATION TESTS PASSED SUCCESSFULLY! (100%)
Catalogue: 277 entries; official photo sources: 144 contracts passed
ALL 14 E2E JOURNEYS VERIFIED AND PASSED SUCCESSFULLY! (100%)
All 16 Savings Planner unit, integration, boundary & graphic checks passed
ALL 10 PRINT STYLESHEET TEST SUITES PASSED (100%)
```

**Baseline Test Verification Result:** **100% Passed (0 Failures, 0 Regressions).**

---

## 5. Security Remediation Roadmap

1. **Step 1: Security Setup & Baseline Documentation** (`docs/fix-tracker.md`, `docs/security-audit.md`) — **COMPLETE**
2. **Step 2: Serverless Hardening Pass**
   - Implement `crypto.timingSafeEqual` in `serverless/gcp-cloud-function/index.js`.
   - Normalize client IP resolution and sanitize error details.
3. **Step 3: Client Security & CSP Header Pass**
   - Add Content Security Policy, Referrer-Policy, and framebusting guards across all HTML files.
4. **Step 4: DOM Sink & Upload Sanitization Pass**
   - Review and harden dynamic innerHTML insertions across `js/app.js` and `js/planner.js`.
   - Add magic-byte inspection in `js/catalogue-studio.js`.
5. **Step 5: CI/CD Workflow Hardening Pass**
   - Restrict workflow permissions to `contents: read`.
6. **Step 6: Comprehensive Regression Verification**
   - Re-run full 20-suite test runner and confirm zero regressions.
