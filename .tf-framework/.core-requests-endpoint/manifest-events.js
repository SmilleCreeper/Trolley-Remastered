const manifest = require('../../application/manifest.json');

function get(key, fallback) {
  if (Object.prototype.hasOwnProperty.call(manifest, key)) {
    return manifest[key];
  }

  return fallback;
}

function all() {
  return { ...manifest };
}

module.exports = {
  get,
  all,
};
