const permissions = require('../../application/permissions.json');

function normalizeActionName(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError('Python action name must be a non-empty string.');
  }

  const name = value.trim();

  if (name.includes('/') || name.includes('\\')) {
    throw new TypeError(
      'Python action names must not contain path separators.',
    );
  }

  return name.endsWith('.py') ? name : `${name}.py`;
}

function normalizeRule(target, rule) {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
    throw new TypeError(`Permission for "${target}" must be an object.`);
  }

  for (const key of Object.keys(rule)) {
    if (key !== 'screens') {
      throw new Error(`Unknown permission key "${key}" for "${target}".`);
    }
  }

  const screens = rule.screens;

  if (screens === undefined) {
    return { screens: [] };
  }

  if (
    !Array.isArray(screens) ||
    screens.some((entry) => typeof entry !== 'string' || entry.trim() === '')
  ) {
    throw new TypeError(
      `Permission "${target}.screens" must be an array of non-empty strings.`,
    );
  }

  return { screens: screens.map((entry) => entry.trim()) };
}

if (
  !permissions ||
  typeof permissions !== 'object' ||
  Array.isArray(permissions)
) {
  throw new TypeError('application/permissions.json must contain an object.');
}

const rules = {};

for (const [target, rule] of Object.entries(permissions)) {
  const targetName = normalizeActionName(target);

  if (Object.prototype.hasOwnProperty.call(rules, targetName)) {
    throw new Error(`Duplicate permission for "${targetName}".`);
  }

  rules[targetName] = normalizeRule(targetName, rule);
}

function canAccess(target, screen) {
  const targetName = normalizeActionName(target);
  const rule = rules[targetName];

  if (!rule) return true;

  if (typeof screen !== 'string' || screen.trim() === '') {
    return false;
  }

  const screenName = screen.trim();
  return rule.screens.includes('*') || rule.screens.includes(screenName);
}

module.exports = {
  canAccess,
};
