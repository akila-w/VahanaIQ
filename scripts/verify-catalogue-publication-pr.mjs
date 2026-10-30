#!/usr/bin/env node
// Trusted base-branch GitHub Actions guard. PR objects are read as inert Git blobs.
// NEVER execute code, workflow commands or shell scripts from the PR head.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { prepareApprovedCataloguePatch } from './prepare-catalogue-publication.mjs';

const dataPath = 'data/catalogue.json';
const scriptPath = 'js/catalogue-data.js';
const evidencePath = 'docs/catalogue-publication-evidence/approval-bundle.json';
const legacyPricePath = 'js/market-catalogue.js';
const requireTrue = (x, reason) => { if (!x) throw new Error(reason); };
const protectedFiles = [dataPath, scriptPath, evidencePath];
const hasPriceFiles = files => protectedFiles.some(p => files.includes(p));

export function verifyPublicationDiff(files, baseCatalogue, identity, proposedJSON,
  proposedJS, bundle, trustedRegistry, options = {}) {
  const changed = new Set(files);
  requireTrue(files.length === changed.size, 'Duplicate diff filenames');
  if (changed.has(legacyPricePath)) {
    throw new Error('Legacy market price publication is suspended pending separate approval controls');
  }
  if (!hasPriceFiles(files)) return { status: 'not-a-price-publication', canPublish: false };
  requireTrue(protectedFiles.every(x => changed.has(x)) && changed.size === protectedFiles.length,
    'Price PR must change exactly two catalogue outputs and signed evidence, nothing else');
  requireTrue(bundle && typeof bundle === 'object' && !Array.isArray(bundle) &&
    bundle.schemaVersion === 1 &&
    Object.keys(bundle).sort().join('|') ===
      ['schemaVersion','research','researchAuthorisation','reviews','authorisation'].sort().join('|'),
    'Incomplete or unexpected publication evidence bundle');
  const expected = prepareApprovedCataloguePatch(baseCatalogue, identity,
    bundle.research, bundle.reviews, bundle.researchAuthorisation,
    bundle.authorisation, trustedRegistry, options);
  requireTrue(proposedJSON === expected.files[dataPath],
    'Catalogue JSON is not the exact approved, deterministic output');
  requireTrue(proposedJS === expected.files[scriptPath],
    'Catalogue JavaScript is not the exact approved, deterministic output');
  return { status: 'signed-price-diff-verified', canPublish: false,
    summary: expected.summary, hashes: expected.hashes };
}

// Demand exact event commit identifiers, never local HEAD or PR-provided commands.
export function inspectTrustedDiff(baseSHA, headSHA, git, options = {}) {
  requireTrue(typeof baseSHA === 'string' && typeof headSHA === 'string' &&
    /^[a-f0-9]{40}$/.test(baseSHA) && /^[a-f0-9]{40}$/.test(headSHA) &&
    baseSHA !== headSHA, 'Missing or invalid trusted base/head SHAs');
  const files = git('diff', '--name-only', '-z', '--no-renames', baseSHA, headSHA)
    .toString('utf8').split('\0').filter(Boolean);
  requireTrue(files.length === new Set(files).size, 'Duplicate or ambiguous changed paths');
  if (!hasPriceFiles(files) && !files.includes(legacyPricePath)) {
    return { status: 'no-price-data-changes', canPublish: false, examinedFiles: files.length };
  }
  requireTrue(!files.includes(legacyPricePath),
    'Legacy market price publication is suspended pending separate approval controls');
  requireTrue(files.length === protectedFiles.length &&
    protectedFiles.every(x => files.includes(x)),
    'Signed catalogue price PR must contain exactly two generated files and evidence bundle');
  const file = (sha, filename) => git('show', sha + ':' + filename).toString('utf8');
  const parsed = (sha, filename) => JSON.parse(file(sha, filename));
  return verifyPublicationDiff(files,
    parsed(baseSHA, dataPath), parsed(baseSHA, 'data/identity.json'),
    file(headSHA, dataPath), file(headSHA, scriptPath),
    parsed(headSHA, evidencePath),
    parsed(baseSHA, 'config/catalogue-publication-approvers.json'), options);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const baseSHA = process.env.PR_BASE_SHA, headSHA = process.env.PR_HEAD_SHA;
    requireTrue(process.env.GITHUB_EVENT_NAME === 'pull_request_target',
      'Guard must run from trusted base-branch pull_request_target workflow');
    const git = (...args) => execFileSync('git', args, { maxBuffer: 12_000_000 });
    const result = inspectTrustedDiff(baseSHA, headSHA, git);
    process.stdout.write('Catalogue trusted approval guard: PASS ' +
      JSON.stringify({ status: result.status, summary: result.summary ?? null }) + '\n');
  } catch (error) {
    process.stderr.write('Catalogue trusted approval guard: BLOCKED — ' + error.message + '\n');
    process.exitCode = 1;
  }
}
