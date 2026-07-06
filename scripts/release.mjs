#!/usr/bin/env node
// Bumps the patch version if a GitHub release for it already exists,
// writes it back to package.json, then builds and publishes the release.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

export function nextFreeVersion(version, exists) {
  let [maj, min, pat] = version.split('.').map(Number);
  while (exists(`${maj}.${min}.${pat}`)) pat++;
  return `${maj}.${min}.${pat}`;
}

if (process.argv.includes('--self-check')) {
  const taken = new Set(['0.1.0', '0.1.1']);
  const exists = (v) => taken.has(v);
  console.assert(nextFreeVersion('0.1.0', exists) === '0.1.2', 'skips taken versions');
  console.assert(nextFreeVersion('0.2.0', exists) === '0.2.0', 'keeps free version');
  console.log('self-check ok');
  process.exit(0);
}

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const pkgPath = new URL('../package.json', import.meta.url);
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

// ponytail: gh network failure reads as "release doesn't exist" — acceptable, gh release create still fails safely on collision
const releaseExists = (v) => {
  try { execSync(`gh release view v${v}`, { stdio: 'ignore' }); return true; }
  catch { return false; }
};

const version = nextFreeVersion(pkg.version, releaseExists);
if (version !== pkg.version) {
  pkg.version = version;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`bumped package.json to ${version}`);
}

run('npm run make-mac-app');
run(`ditto -c -k --keepParent 'release/mac-arm64/Beads Sprints.app' release/Beads-Sprints-mac-arm64.zip`);
run(`gh release create v${version} release/Beads-Sprints-mac-arm64.zip --title v${version} --generate-notes`);
