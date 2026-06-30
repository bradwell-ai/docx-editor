#!/usr/bin/env node
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const outDir = path.resolve(ROOT, process.env.PACK_DESTINATION ?? 'dist-tarballs');

const packages = [
  { name: '@eigenpal/docx-editor-i18n', path: 'packages/i18n' },
  { name: '@eigenpal/docx-editor-core', path: 'packages/core' },
  { name: '@eigenpal/docx-editor-agents', path: 'packages/agents' },
  { name: '@eigenpal/docx-editor-react', path: 'packages/react' },
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    env: { ...process.env, ...options.env },
  });
  if (result.status !== 0) {
    if (options.capture) {
      process.stderr.write(result.stdout ?? '');
      process.stderr.write(result.stderr ?? '');
    }
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
  return result.stdout ?? '';
}

function buildPackages() {
  if (process.env.SKIP_TARBALL_BUILD === '1') return;

  for (const pkg of packages) {
    run('npm', ['run', '--prefix', pkg.path, 'build'], {
      env: { NODE_OPTIONS: process.env.NODE_OPTIONS ?? '--max-old-space-size=8192' },
    });
  }
}

function packPackage(pkg) {
  const output = run(
    'npm',
    ['pack', path.join(ROOT, pkg.path), '--json', '--pack-destination', outDir],
    { capture: true }
  );
  const [packed] = JSON.parse(output);
  if (!packed?.filename) throw new Error(`npm pack returned no filename for ${pkg.name}`);
  return path.join(outDir, packed.filename);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

buildPackages();

const tarballs = packages.map(packPackage);
console.log('\nCreated release tarballs:');
for (const tarball of tarballs) {
  console.log(`- ${path.relative(ROOT, tarball)}`);
}
