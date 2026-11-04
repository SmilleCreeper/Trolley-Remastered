import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import {
  installPythonRequirements,
  rebuildAddon,
  runCommand,
  runNodeCli,
  stagePython,
  verifyPythonRequirements,
} from './python-runtime.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const require = createRequire(import.meta.url);
const skipCheck = process.argv.includes('--skip-check');
const refresh = process.argv.includes('--refresh');
const refreshPython =
  refresh || process.argv.includes('--refresh-python');

function log(message) {
  process.stdout.write(`[setup] ${message}\n`);
}

function assertNodeVersion() {
  const major = Number(process.versions.node.split('.')[0]);

  if (!Number.isFinite(major) || major < 22) {
    throw new Error(
      `Node.js 22 or newer is required. Current version: ${process.versions.node}.`,
    );
  }
}

function nodeDependenciesReady() {
  const nodeModules = path.join(root, 'node_modules');

  return [
    'electron/package.json',
    'electron-builder/package.json',
    'node-gyp/package.json',
    'node-calls-python/package.json',
  ].every((entry) => fs.existsSync(path.join(nodeModules, entry)));
}

function electronBinaryReady() {
  const electronDirectory = path.join(root, 'node_modules', 'electron');
  const pathFile = path.join(electronDirectory, 'path.txt');

  if (!fs.existsSync(pathFile)) return false;

  const relativePath = fs.readFileSync(pathFile, 'utf8').trim();
  if (!relativePath) return false;

  return fs.existsSync(path.join(electronDirectory, 'dist', relativePath));
}

async function installElectronBinary() {
  if (electronBinaryReady()) return;

  const electronDirectory = path.join(root, 'node_modules', 'electron');
  const installer = path.join(electronDirectory, 'install.js');

  if (!fs.existsSync(installer)) {
    throw new Error(
      'The Electron package is incomplete. Run vendor-setup.bat --refresh.',
    );
  }

  log('Downloading the Electron runtime');
  await runNodeCli(installer, [], { cwd: electronDirectory });
}

async function installNodeDependencies() {
  if (nodeDependenciesReady() && !refresh) {
    log('Node dependencies are already installed');
    await installElectronBinary();
    return;
  }

  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const nodeModules = path.join(root, 'node_modules');
  const useCleanInstall = refresh || !fs.existsSync(nodeModules);

  log(
    'Installing Node dependencies (Electron, electron-builder, node-gyp, node-calls-python)',
  );

  await runCommand(
    npm,
    [
      useCleanInstall ? 'ci' : 'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
    ],
    {
      cwd: root,
      shell: process.platform === 'win32',
    },
  );

  await installElectronBinary();
}

async function runSetupCheck() {
  const electronPath = require('electron');
  const checkScript = path.join(__dirname, 'setup-check.js');

  if (!fs.existsSync(electronPath)) {
    throw new Error(`Electron executable not found at ${electronPath}.`);
  }

  log('Running sanity check');
  await runCommand(electronPath, [checkScript], {
    cwd: root,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
    },
    timeoutMs: 120000,
  });
}

async function main() {
  assertNodeVersion();
  await installNodeDependencies();

  stagePython({ refresh: refreshPython });
  installPythonRequirements();
  verifyPythonRequirements();

  await rebuildAddon();

  if (!skipCheck) {
    await runSetupCheck();
  }

  log('Setup complete');
  log('Run distribution\\build.bat to build the installer.');
}

main().catch((error) => {
  console.error(`[setup] ${error.stack || error.message}`);
  process.exitCode = 1;
});
