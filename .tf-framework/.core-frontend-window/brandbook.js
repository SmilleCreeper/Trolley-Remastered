let brandbook = {};

try {
  brandbook = require('../../application/brandbook.json');
} catch (error) {
  console.warn(
    'Could not load application/brandbook.json. Using framework defaults.',
    error.message,
  );
}

const variables = [
  ['--titlebar-background', ['titlebar', 'background']],
  ['--titlebar-minimize-button-text', ['titlebar', 'minimizeButton', 'text']],
  [
    '--titlebar-minimize-button-hover-background',
    ['titlebar', 'minimizeButton', 'hoverBackground'],
  ],
  ['--titlebar-close-button-text', ['titlebar', 'closeButton', 'text']],
  [
    '--titlebar-close-button-hover-background',
    ['titlebar', 'closeButton', 'hoverBackground'],
  ],
  ['--progress-text', ['progressBar', 'text']],
  ['--progress-fill', ['progressBar', 'fill']],
  ['--progress-fill-increase', ['progressBar', 'increaseFill']],
  ['--progress-fill-decrease', ['progressBar', 'decreaseFill']],
];

function read(path) {
  let value = brandbook;

  for (const key of path) {
    if (!value || typeof value !== 'object') return null;
    value = value[key];
  }

  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function apply(root = document.documentElement) {
  for (const [variable, path] of variables) {
    const value = read(path);

    if (value) {
      root.style.setProperty(variable, value);
    } else {
      root.style.removeProperty(variable);
    }
  }
}

module.exports = {
  apply,
  all() {
    return { ...brandbook };
  },
};
