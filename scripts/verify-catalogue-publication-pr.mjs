#!/usr/bin/env node
// Required PR guard: verify actual price-changing file bytes against signed evidence.
// The PR's branch cannot replace trust keys because base-branch registry is read via git show.
// No writes, no network, no price publication.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { prepareApprovedCataloguePatch } from './prepare-catalogue-publication.mjs';

const dataPath = 'data/catalogue.json';
const scriptPath = 'js/catalogue-data.js';
const evidencePath = 'docs/catalogue-publication-evidence/approval-bundle.json';
const requireTrue = (x, reason) => { if (!x) throw new Error(reason); };

export function verifyPublicationDiff(files, baseCatalogue, identity, proposedJSON,
  proposedJS, bundle, trustedRegistry, options = {}) {
  const changed = new Set(files);
  requireTrue(files.length === changed.size, 'Duplicate diff filenames');
  const protectedFiles = [dataPath, scriptPath, evidencePath];
  const some = protectedFiles.some(x => changed.has(x));
  if (!some) return { status: 'not-a-price-publication', canPublish: false };
  requireTrue(protectedFiles.every(x => changed.has(x)) && changed.size === protectedFiles.length,
    'Price PR must change exactly the two catalogue outputs and signed evidence, nothing else');
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

if (process.argv[1] && process.argv[1].endsWith('/verify-catalogue-publication-pr.mjs')) {
  try {
    // In Actions, this is injected from github.event.pull_request.base.sha,
    // never a user-supplied manifest or PR branch field.
    const baseSHA = process.env.PR_BASE_SHA;
    requireTrue(process.env.GITHUB_EVENT_NAME === 'pull_request' &&
      typeof baseSHA === 'string' && /^[a-f0-9]{40}$/.test(baseSHA),
      'Requires a trusted pull_request event and its exact base commit SHA');
    const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 12_000_000 });
    const files = git('diff', '--name-only', '--diff-filter=ACDMRT', baseSHA, 'HEAD')
      .trim().split('\n').filter(Boolean);
    const baseFile = filename => git('show', baseSHA + ':' + filename);
    const isPricePR = [dataPath, scriptPath, evidencePath].some(p => files.includes(p));
    if (!isPricePR) {
      // A tracked trust change must be separately reviewed; it cannot accompany price publication.
      process.stdout.write('Catalogue approval PR guard: PASS (no published price files modified)\n');
    } else {
      const parse = s => JSON.parse(s);
      const verdict = verifyPublicationDiff(files,
        parse(baseFile(dataPath)), parse(baseFile('data/identity.json')),
        readFileSync(dataPath, 'utf8'), readFileSync(scriptPath, 'utf8'),
        parse(readFileSync(evidencePath, 'utf8')),
        parse(baseFile('config/catalogue-publication-approvers.json')));
      process.stdout.write('Catalogue approval PR guard: PASS ' +
        JSON.stringify(verdict.summary) + '\n');
    }
  } catch (error) {
    process.stderr.write('Catalogue approval PR guard: BLOCKED — ' + error.message + '\n');
    process.exitCode = 1;
  }
}
