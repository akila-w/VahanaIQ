// VahanaIQ Platform Configuration
// -------------------------------------------------------------
// SECURE BACKEND PROXY (RECOMMENDED):
// To use the platform without exposing your Gemini API key in the browser,
// deploy the free Cloudflare Worker or Vercel function in /serverless
// and paste its URL here (e.g. "https://vahanaiq-proxy.example.workers.dev").
//
// DIRECT KEY (ALTERNATIVE):
// If using direct Google AI Studio API without a proxy, restrict your key
// in Google Cloud Console to HTTP Referrer (https://akila-w.github.io/*).
export const config = {
  proxyUrl: "https://vahanaiq-search-71962876227.asia-south1.run.app",
  apiKey: ""
};
