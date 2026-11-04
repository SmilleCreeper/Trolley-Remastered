const fs = require('fs');
const path = require('path');

const pythonHome = path.resolve(
  __dirname,
  '..',
  '.core-vendor-software',
  'python',
);

const pythonLib = path.join(pythonHome, 'Lib');
const pythonDlls = path.join(pythonHome, 'DLLs');

if (!fs.existsSync(path.join(pythonHome, 'python.exe'))) {
  throw new Error(
    `Embedded Python runtime not found at ${pythonHome}. Run vendor-setup.bat first.`,
  );
}

const pythonZip = fs
  .readdirSync(pythonHome)
  .find((entry) => /^python3.*\.zip$/i.test(entry));

process.env.PYTHONHOME = pythonHome;
process.env.PYTHONPATH = [
  pythonLib,
  pythonDlls,
  pythonZip && path.join(pythonHome, pythonZip),
  __dirname,
]
  .filter(Boolean)
  .join(path.delimiter);
process.env.PYTHONNOUSERSITE = '1';
process.env.PYTHONDONTWRITEBYTECODE = '1';
process.env.PYTHONUTF8 = '1';
process.env.PATH = [pythonHome, pythonDlls, process.env.PATH]
  .filter(Boolean)
  .join(path.delimiter);

let interpreter;

try {
  interpreter = require('node-calls-python').interpreter;
} catch (error) {
  throw new Error(
    `Failed to load the embedded Python runtime from ${pythonHome}: ${error.message}`,
  );
}

const bridgeModuleName = 'python_to_framework_bridge';
const bridgePath = path.join(__dirname, 'python-to-framework-bridge.py');

interpreter.execSync(
  {},
  [
    'import importlib.util',
    'import sys',
    '',
    `name = ${JSON.stringify(bridgeModuleName)}`,
    `path = ${JSON.stringify(bridgePath)}`,
    '',
    'if name not in sys.modules:',
    '    spec = importlib.util.spec_from_file_location(name, path)',
    '    module = importlib.util.module_from_spec(spec)',
    '    sys.modules[name] = module',
    '    spec.loader.exec_module(module)',
  ].join('\n'),
);

module.exports = interpreter;
