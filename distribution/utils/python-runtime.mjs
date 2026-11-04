import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const root = path.resolve(__dirname, '..', '..');
export const pythonHome = path.join(
  root,
  '.tf-framework',
  '.core-vendor-software',
  'python',
);

const manifestPath = path.join(root, 'application', 'manifest.json');
const pythonExecutable = path.join(pythonHome, 'python.exe');

export function log(message) {
  process.stdout.write(`[python] ${message}\n`);
}

function isBuildablePython(directory) {
  if (!directory) return false;

  return ['python.exe', 'Lib', 'DLLs', 'include', 'libs'].every((entry) =>
    fs.existsSync(path.join(directory, entry)),
  );
}

export function findSourcePython() {
  const candidates = [
    process.env.TROLLEY_PYTHON_HOME,
    process.env.PYTHON_HOME,
  ].filter(Boolean);

  const commands = process.platform === 'win32'
    ? [
        ['python', ['-c', 'import sys; print(sys.base_prefix)']],
        ['py', ['-3', '-c', 'import sys; print(sys.base_prefix)']],
      ]
    : [
        ['python3', ['-c', 'import sys; print(sys.base_prefix)']],
        ['python', ['-c', 'import sys; print(sys.base_prefix)']],
      ];

  for (const [command, args] of commands) {
    const result = spawnSync(command, args, {
      cwd: root,
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    });

    if (!result.error && result.status === 0) {
      const output = result.stdout.trim().split(/\r?\n/).pop();
      if (output) candidates.push(output.trim());
    }
  }

  for (const candidate of candidates) {
    if (isBuildablePython(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'No buildable Python installation found. Install CPython 3.14 with ' +
      '`winget install -e --id Python.Python.3.14`, or set TROLLEY_PYTHON_HOME ' +
      'to a CPython installation that includes Lib, include, and libs.',
  );
}

function copyRuntimeFile(sourceDirectory, fileName, destinationDirectory) {
  const source = path.join(sourceDirectory, fileName);
  if (!fs.existsSync(source)) return;

  fs.copyFileSync(source, path.join(destinationDirectory, fileName));
}

export function stagePython({
  refresh = process.argv.includes('--refresh-python'),
} = {}) {
  const required = ['python.exe', 'Lib', 'DLLs', 'include', 'libs'];

  if (
    !refresh &&
    required.every((entry) => fs.existsSync(path.join(pythonHome, entry)))
  ) {
    log(`Using vendored Python at ${pythonHome}`);
    return;
  }

  const source = findSourcePython();
  log(`Staging Python from ${source}`);

  fs.rmSync(pythonHome, { recursive: true, force: true });
  fs.mkdirSync(pythonHome, { recursive: true });

  const rootEntries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of rootEntries) {
    if (!entry.isFile()) continue;

    if (
      /^python(?:3|3\d+)\.dll$/i.test(entry.name) ||
      /^python3.*\.zip$/i.test(entry.name) ||
      /^vcruntime140.*\.dll$/i.test(entry.name) ||
      /^pythonw?\.exe$/i.test(entry.name) ||
      entry.name === 'LICENSE.txt'
    ) {
      copyRuntimeFile(source, entry.name, pythonHome);
    }
  }

  for (const directory of ['DLLs', 'include', 'libs']) {
    fs.cpSync(path.join(source, directory), path.join(pythonHome, directory), {
      recursive: true,
    });
  }

  const sourceLib = path.join(source, 'Lib');
  const destinationLib = path.join(pythonHome, 'Lib');
  const excluded = new Set([
    'site-packages',
    'test',
    'tests',
    'idlelib',
    'tkinter',
    'turtledemo',
    'ensurepip',
    'lib2to3',
    '__pycache__',
  ]);

  fs.cpSync(sourceLib, destinationLib, {
    recursive: true,
    filter: (entry) => {
      const relative = path.relative(sourceLib, entry);
      if (!relative) return true;

      const topLevel = relative.split(path.sep)[0];
      return !excluded.has(topLevel);
    },
  });

  log(`Vendored Python staged at ${pythonHome}`);
}

function cleanPathEntries() {
  return (process.env.PATH || '')
    .split(path.delimiter)
    .filter((entry) => entry && !/python/i.test(entry));
}

export function pythonEnvironment() {
  return {
    ...process.env,
    PATH: [pythonHome, path.join(pythonHome, 'DLLs'), ...cleanPathEntries()].join(
      path.delimiter,
    ),
    PYTHONHOME: pythonHome,
    PYTHONPATH: path.join(pythonHome, 'Lib'),
    PYTHONNOUSERSITE: '1',
    PYTHONUTF8: '1',
    npm_config_python: pythonExecutable,
    CSC_IDENTITY_AUTO_DISCOVERY: 'false',
  };
}

function pythonRunEnvironment() {
  return {
    ...process.env,
    PATH: [pythonHome, path.join(pythonHome, 'DLLs'), ...cleanPathEntries()].join(
      path.delimiter,
    ),
    PYTHONHOME: pythonHome,
    PYTHONNOUSERSITE: '1',
    PYTHONUTF8: '1',
    PYTHONDONTWRITEBYTECODE: '1',
    PIP_DISABLE_PIP_VERSION_CHECK: '1',
    PIP_NO_INPUT: '1',
  };
}

export function runVendoredPython(args, { capture = false, stdio } = {}) {
  const result = spawnSync(pythonExecutable, args, {
    cwd: root,
    env: pythonRunEnvironment(),
    encoding: 'utf8',
    stdio: stdio || (capture ? 'pipe' : 'inherit'),
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const detail = capture
      ? (result.stderr || result.stdout || '').trim()
      : '';

    throw new Error(
      `Python command failed (${args.join(' ')}).${detail ? `\n${detail}` : ''}`,
    );
  }

  return capture ? (result.stdout || '').trim() : '';
}

function hasPip() {
  const result = spawnSync(pythonExecutable, ['-m', 'pip', '--version'], {
    cwd: root,
    env: pythonRunEnvironment(),
    encoding: 'utf8',
    windowsHide: true,
  });

  return !result.error && result.status === 0;
}

export function ensurePip() {
  if (!fs.existsSync(pythonExecutable)) {
    throw new Error(
      `Embedded Python runtime not found at ${pythonHome}. Run vendor-setup.bat first.`,
    );
  }

  if (hasPip()) return;

  const ensurepip = path.join(pythonHome, 'Lib', 'ensurepip');

  if (!fs.existsSync(ensurepip)) {
    const source = findSourcePython();
    const sourceEnsurepip = path.join(source, 'Lib', 'ensurepip');

    if (!fs.existsSync(sourceEnsurepip)) {
      throw new Error(
        `pip is not available in the vendored Python runtime and ${source} ` +
          'does not include the ensurepip module.',
      );
    }

    fs.cpSync(sourceEnsurepip, ensurepip, { recursive: true });
  }

  log('Bootstrapping pip into the vendored Python runtime');
  runVendoredPython(['-m', 'ensurepip', '--upgrade'], { stdio: 'inherit' });

  if (!hasPip()) {
    throw new Error('pip bootstrap failed in the vendored Python runtime.');
  }

  log('pip is ready');
}

function readManifest() {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Application manifest not found at ${manifestPath}.`);
  }

  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Application manifest is not valid JSON: ${error.message}`,
    );
  }
}

export function readPythonRequirements() {
  const manifest = readManifest();
  const value = manifest.pythonRequirements;

  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(
      'application/manifest.json "pythonRequirements" must be an array.',
    );
  }

  return value.map((entry, index) => {
    const where = `pythonRequirements[${index}]`;

    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`${where} must be an object.`);
    }

    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';

    if (!name) {
      throw new Error(`${where}.name must be a non-empty string.`);
    }

    if (!id) {
      throw new Error(`${where}.id must be a non-empty package specifier.`);
    }

    if (id.startsWith('-')) {
      throw new Error(
        `${where}.id must be a package specifier, not a pip option.`,
      );
    }

    const rawIndexUrl = Object.prototype.hasOwnProperty.call(entry, 'index-url')
      ? entry['index-url']
      : entry.indexUrl;

    if (
      rawIndexUrl !== undefined &&
      rawIndexUrl !== null &&
      typeof rawIndexUrl !== 'string'
    ) {
      throw new Error(`${where}."index-url" must be a string or null.`);
    }

    const indexUrl = rawIndexUrl ? rawIndexUrl.trim() : '';

    if (indexUrl.startsWith('-')) {
      throw new Error(
        `${where}."index-url" must be a package index URL, not a pip option.`,
      );
    }

    return {
      name,
      id,
      indexUrl: indexUrl || null,
    };
  });
}

export function installPythonRequirements() {
  const requirements = readPythonRequirements();

  if (requirements.length === 0) {
    log('No Python requirements declared');
    return;
  }

  ensurePip();

  for (const requirement of requirements) {
    const args = [
      '-m',
      'pip',
      'install',
      '--disable-pip-version-check',
      '--no-input',
      '--no-warn-script-location',
      '--upgrade',
    ];

    if (requirement.indexUrl) {
      args.push('--index-url', requirement.indexUrl);
      log(`Using Python package index ${requirement.indexUrl}`);
    }

    args.push(requirement.id);
    log(
      `Installing Python requirement "${requirement.name}" (${requirement.id})`,
    );
    runVendoredPython(args, { stdio: 'inherit' });
  }

  log(
    `Python requirements installed: ${requirements
      .map((requirement) => requirement.name)
      .join(', ')}`,
  );
}

function distributionName(id) {
  let spec = String(id).split(';')[0].trim();

  if (!spec || spec.startsWith('-')) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(spec)) return null;
  if (/^(?:git|hg|svn|bzr)\+/i.test(spec)) return null;
  if (/^[.\\/]/.test(spec) || /\.whl$/i.test(spec)) return null;

  const directReference = spec.indexOf(' @ ');
  if (directReference !== -1) {
    spec = spec.slice(0, directReference).trim();
  }

  spec = spec.replace(/\[[^\]]*\]/g, '').trim();

  const match = spec.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)/);
  return match ? match[1] : null;
}

export function verifyPythonRequirements() {
  const requirements = readPythonRequirements();

  if (requirements.length === 0) return;

  // Environment markers can make pip skip a requirement, so only verify
  // unconditional package specifiers.
  const names = [
    ...new Set(
      requirements
        .filter((requirement) => !requirement.id.includes(';'))
        .map((requirement) => distributionName(requirement.id))
        .filter(Boolean),
    ),
  ];

  if (names.length > 0) {
    const code = [
      'import importlib.metadata as metadata',
      `names = ${JSON.stringify(names)}`,
      'missing = []',
      'for name in names:',
      '    try:',
      '        metadata.version(name)',
      '    except metadata.PackageNotFoundError:',
      '        missing.append(name)',
      'if missing:',
      '    raise SystemExit("Missing Python requirements: " + ", ".join(missing))',
      'print("Python requirements verified: " + ", ".join(names))',
    ].join('\n');

    log(runVendoredPython(['-c', code], { capture: true }));
  }

  log(
    runVendoredPython(
      ['-m', 'pip', 'check', '--disable-pip-version-check'],
      { capture: true },
    ),
  );
}

export function runCommand(command, args, options = {}) {
  const { timeoutMs, ...spawnOptions } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      ...spawnOptions,
    });

    let settled = false;
    let timer = null;

    function finish(error) {
      if (settled) return;
      settled = true;

      if (timer) clearTimeout(timer);

      if (error) reject(error);
      else resolve();
    }

    if (timeoutMs) {
      timer = setTimeout(() => {
        child.kill();
        finish(
          new Error(
            `${path.basename(command)} did not finish within ${timeoutMs}ms.`,
          ),
        );
      }, timeoutMs);
    }

    child.on('error', finish);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        finish();
        return;
      }

      finish(
        new Error(
          `${path.basename(command)} exited with code ${code}${
            signal ? ` (${signal})` : ''
          }.`,
        ),
      );
    });
  });
}

export function runNodeCli(script, args, options = {}) {
  return runCommand(process.execPath, [script, ...args], options);
}

export async function rebuildAddon() {
  log('Rebuilding node-calls-python for Electron');

  const electronPackagePath = path.join(
    root,
    'node_modules',
    'electron',
    'package.json',
  );
  const nodeGyp = path.join(
    root,
    'node_modules',
    'node-gyp',
    'bin',
    'node-gyp.js',
  );

  if (!fs.existsSync(electronPackagePath) || !fs.existsSync(nodeGyp)) {
    throw new Error(
      'Node dependencies are missing. Run vendor-setup.bat before rebuilding the addon.',
    );
  }

  const electronPackage = JSON.parse(
    fs.readFileSync(electronPackagePath, 'utf8'),
  );

  try {
    await runNodeCli(
      nodeGyp,
      [
        'rebuild',
        '--runtime=electron',
        `--target=${electronPackage.version}`,
        `--arch=${process.arch}`,
        '--dist-url=https://www.electronjs.org/headers',
        '--build-from-source',
      ],
      {
        cwd: path.join(root, 'node_modules', 'node-calls-python'),
        env: pythonEnvironment(),
      },
    );
  } catch (error) {
    throw new Error(
      `${error.message}\nThe native addon rebuild requires Visual Studio ` +
        'Build Tools with the C++ workload.',
    );
  }

  log('node-calls-python rebuilt for Electron');
}
