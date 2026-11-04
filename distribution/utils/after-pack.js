const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const iconSource = path.join(root, 'application', 'icon.png');

function findFirst(candidates, description) {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }

  throw new Error(
    `Could not find ${description}. Run vendor-setup.bat before building.`,
  );
}

function findAppBuilder() {
  const arch =
    process.arch === 'arm64'
      ? 'arm64'
      : process.arch === 'ia32'
        ? 'ia32'
        : 'x64';

  return findFirst(
    [
      path.join(
        root,
        'node_modules',
        'app-builder-bin',
        'win',
        arch,
        'app-builder.exe',
      ),
      path.join(
        root,
        'node_modules',
        'app-builder-bin',
        'win',
        'x64',
        'app-builder.exe',
      ),
    ],
    'app-builder.exe',
  );
}

function findRcedit() {
  const candidates = [
    path.join(
      root,
      'node_modules',
      'electron-winstaller',
      'vendor',
      'rcedit.exe',
    ),
    path.join(
      root,
      'node_modules',
      'electron-winstaller',
      'vendor',
      'rcedit-x64.exe',
    ),
  ];

  const cacheRoot = path.join(
    process.env.LOCALAPPDATA || '',
    'electron-builder',
    'Cache',
    'winCodeSign',
  );

  if (cacheRoot && fs.existsSync(cacheRoot)) {
    for (const entry of fs.readdirSync(cacheRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      candidates.push(path.join(cacheRoot, entry.name, 'rcedit-x64.exe'));
      candidates.push(path.join(cacheRoot, entry.name, 'rcedit.exe'));
    }
  }

  return findFirst(candidates, 'rcedit.exe');
}

function createIcon(outputRoot) {
  const outputDirectory = path.join(outputRoot, '.icon-ico');
  fs.mkdirSync(outputDirectory, { recursive: true });

  const appBuilder = findAppBuilder();
  const output = execFileSync(
    appBuilder,
    [
      'icon',
      '-f',
      'ico',
      '--out',
      outputDirectory,
      '--root',
      root,
      '-i',
      path.relative(root, iconSource),
    ],
    {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
    },
  );

  const jsonLine = output
    .trim()
    .split(/\r?\n/)
    .reverse()
    .find((line) => line.trim().startsWith('{'));

  if (!jsonLine) {
    throw new Error(`app-builder did not report an icon: ${output}`);
  }

  const result = JSON.parse(jsonLine);
  const icon = Array.isArray(result.icons) ? result.icons[0] : null;

  if (!icon || !icon.file || !fs.existsSync(icon.file)) {
    throw new Error(`app-builder did not create an icon: ${output}`);
  }

  return icon.file;
}

function patchExecutable(executable, icon, appInfo) {
  const rcedit = findRcedit();
  const fileVersion =
    appInfo.shortVersion || appInfo.buildVersion || appInfo.version;
  const productVersion =
    appInfo.shortVersionWindows ||
    (typeof appInfo.getVersionInWeirdWindowsForm === 'function'
      ? appInfo.getVersionInWeirdWindowsForm()
      : fileVersion);
  const args = [
    executable,
    '--set-icon',
    icon,
    '--set-version-string',
    'ProductName',
    appInfo.productName,
    '--set-version-string',
    'FileDescription',
    appInfo.productName,
    '--set-version-string',
    'InternalName',
    path.basename(executable, '.exe'),
    '--set-version-string',
    'OriginalFilename',
    path.basename(executable),
    '--set-file-version',
    fileVersion,
    '--set-product-version',
    productVersion,
  ];

  if (appInfo.copyright) {
    args.push('--set-version-string', 'LegalCopyright', appInfo.copyright);
  }

  execFileSync(rcedit, args, {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  });
}

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const appInfo = context.packager.appInfo;
  const executable = path.join(
    context.appOutDir,
    `${appInfo.productFilename}.exe`,
  );

  if (!fs.existsSync(executable)) {
    throw new Error(`Packaged executable not found: ${executable}`);
  }

  const icon = createIcon(context.outDir);
  patchExecutable(executable, icon, appInfo);
  console.log(
    `[after-pack] Applied application/icon.png to ${path.basename(executable)}`,
  );
};
