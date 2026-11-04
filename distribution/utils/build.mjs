import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  installPythonRequirements,
  pythonEnvironment,
  rebuildAddon,
  runNodeCli,
  stagePython,
  verifyPythonRequirements,
} from './python-runtime.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const buildResults = path.join(__dirname, '..', 'build-results');
const isDirectoryBuild = process.argv.includes('--dir');
const isAddonRebuild = process.argv.includes('--rebuild-addon');

function log(message) {
  process.stdout.write(`[build] ${message}\n`);
}

async function packageApplication() {
  fs.mkdirSync(buildResults, { recursive: true });
  log('Packaging application');

  const script = path.join(root, 'node_modules', 'electron-builder', 'cli.js');

  const args = process.platform === 'win32' ? ['--win'] : [];
  if (isDirectoryBuild) args.push('--dir');

  await runNodeCli(script, args, {
    env: pythonEnvironment(),
  });
}

async function main() {
  stagePython();
  installPythonRequirements();
  verifyPythonRequirements();
  await rebuildAddon();

  if (isAddonRebuild) {
    log('Addon rebuild complete');
    return;
  }

  await packageApplication();
  log(`Build complete: ${buildResults}`);
}

main().catch((error) => {
  console.error(`[build] ${error.stack || error.message}`);
  process.exitCode = 1;
});
