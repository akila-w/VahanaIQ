import assert from 'node:assert/strict';
import { resolveClientIp } from '../serverless/shared/proxy-logic.js';

// 1. TRUSTED_PROXY off uses the socket IP (or 'shared-proxy' if socket IP is missing)
assert.equal(
  resolveClientIp({ forwardedFor: '203.0.113.7', socketIp: '192.0.2.1', trusted: false }),
  '192.0.2.1',
  'TRUSTED_PROXY off uses the socket IP'
);
assert.equal(
  resolveClientIp({ forwardedFor: '203.0.113.7', socketIp: '192.0.2.1', trusted: undefined }),
  '192.0.2.1',
  'TRUSTED_PROXY undefined uses the socket IP'
);
assert.equal(
  resolveClientIp({ forwardedFor: '203.0.113.7', trusted: false }),
  'shared-proxy',
  'TRUSTED_PROXY off without socket IP falls back to shared-proxy'
);

// 2. hops=1 takes the last entry
assert.equal(
  resolveClientIp({ forwardedFor: '198.51.100.1, 203.0.113.7', socketIp: '192.0.2.1', trusted: true, hops: 1 }),
  '203.0.113.7',
  'hops=1 takes the last entry'
);
assert.equal(
  resolveClientIp({ forwardedFor: '203.0.113.7', socketIp: '192.0.2.1', trusted: true, hops: 1 }),
  '203.0.113.7',
  'single entry with hops=1 takes that entry'
);

// 3. A forged prefix ("9.9.9.9, 203.0.113.7") yields 203.0.113.7
assert.equal(
  resolveClientIp({ forwardedFor: '9.9.9.9, 203.0.113.7', socketIp: '192.0.2.1', trusted: true, hops: 1 }),
  '203.0.113.7',
  'forged prefix yields the appended client IP'
);
assert.equal(
  resolveClientIp({ forwardedFor: '1.1.1.1, 2.2.2.2, 203.0.113.7', socketIp: '192.0.2.1', trusted: true, hops: 1 }),
  '203.0.113.7',
  'multiple forged prefixes yield the rightmost entry'
);

// 4. A chain shorter than hops falls back to the socket
assert.equal(
  resolveClientIp({ forwardedFor: '203.0.113.7', socketIp: '192.0.2.1', trusted: true, hops: 2 }),
  '192.0.2.1',
  'chain shorter than hops falls back to the socket'
);
assert.equal(
  resolveClientIp({ forwardedFor: '', socketIp: '192.0.2.1', trusted: true, hops: 1 }),
  '192.0.2.1',
  'empty forwardedFor falls back to socket IP'
);
assert.equal(
  resolveClientIp({ forwardedFor: undefined, socketIp: '192.0.2.1', trusted: true, hops: 1 }),
  '192.0.2.1',
  'missing forwardedFor falls back to socket IP'
);
assert.equal(
  resolveClientIp({ forwardedFor: '   ', trusted: true, hops: 1 }),
  'shared-proxy',
  'whitespace-only forwardedFor without socket falls back to shared-proxy'
);

// 5. Bracketed IPv6 and IPv4:port are normalised; IPv6 left intact
assert.equal(
  resolveClientIp({ forwardedFor: '[2001:db8::1]', socketIp: '192.0.2.1', trusted: true, hops: 1 }),
  '2001:db8::1',
  'bracketed IPv6 has brackets stripped'
);
assert.equal(
  resolveClientIp({ forwardedFor: '2001:db8::1', socketIp: '192.0.2.1', trusted: true, hops: 1 }),
  '2001:db8::1',
  'IPv6 without brackets remains intact'
);
assert.equal(
  resolveClientIp({ forwardedFor: '[2001:db8::1]:8080', socketIp: '192.0.2.1', trusted: true, hops: 1 }),
  '2001:db8::1',
  'bracketed IPv6 with port is normalised'
);
assert.equal(
  resolveClientIp({ forwardedFor: '203.0.113.7:8080', socketIp: '192.0.2.1', trusted: true, hops: 1 }),
  '203.0.113.7',
  'IPv4:port has port stripped'
);
assert.equal(
  resolveClientIp({ forwardedFor: '[203.0.113.7]:8080', socketIp: '192.0.2.1', trusted: true, hops: 1 }),
  '203.0.113.7',
  'bracketed IPv4:port is normalised'
);
assert.equal(
  resolveClientIp({ forwardedFor: '[203.0.113.7]', socketIp: '192.0.2.1', trusted: true, hops: 1 }),
  '203.0.113.7',
  'bracketed IPv4 has brackets stripped'
);

// 6. Junk characters fall back
assert.equal(
  resolveClientIp({ forwardedFor: 'invalid_ip', socketIp: '192.0.2.1', trusted: true, hops: 1 }),
  '192.0.2.1',
  'invalid_ip falls back to socket IP'
);
assert.equal(
  resolveClientIp({ forwardedFor: '203.0.113.7; drop table', socketIp: '192.0.2.1', trusted: true, hops: 1 }),
  '192.0.2.1',
  'SQL injection junk falls back to socket IP'
);
assert.equal(
  resolveClientIp({ forwardedFor: 'junk', socketIp: '192.0.2.1', trusted: true, hops: 1 }),
  '192.0.2.1',
  'junk string falls back to socket IP'
);
assert.equal(
  resolveClientIp({ forwardedFor: '198.51.100.1, junk', socketIp: '192.0.2.1', trusted: true, hops: 1 }),
  '192.0.2.1',
  'junk candidate entry falls back to socket IP'
);
assert.equal(
  resolveClientIp({ forwardedFor: '192.0.2.1/24', socketIp: '192.0.2.1', trusted: true, hops: 1 }),
  '192.0.2.1',
  'CIDR notation falls back to socket IP'
);
assert.equal(
  resolveClientIp({ forwardedFor: '<script>', trusted: true, hops: 1 }),
  'shared-proxy',
  'malicious string without socket IP falls back to shared-proxy'
);

console.log('All client-ip resolution tests passed');
