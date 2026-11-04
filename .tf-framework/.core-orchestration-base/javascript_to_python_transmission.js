const permissionsCheck = require('../.core-backend-engine/javascript-to-python-permissions.js');
const {
  createJavaScriptToPythonExecution,
} = require('../.core-backend-engine/javascript-to-python-execution.js');

function createJavaScriptToPythonTransmission({
  screen,
  modelDirectory,
  progress,
  navigate,
  isActive,
}) {
  if (typeof screen !== 'string' || screen.trim() === '') {
    throw new TypeError(
      'JavaScript-to-Python transmission requires a screen name.',
    );
  }

  const screenName = screen.trim();
  const execution = createJavaScriptToPythonExecution({
    modelDirectory,
    progress,
    navigate,
    isActive,
  });

  async function run(file, payload = {}) {
    if (!isActive()) return undefined;

    if (!permissionsCheck.canAccess(file, screenName)) {
      const fileName = file.trim().endsWith('.py')
        ? file.trim()
        : `${file.trim()}.py`;

      throw new Error(
        `Screen "${screenName}" is not allowed to request Python action "${fileName}".`,
      );
    }

    return execution.run(file, payload);
  }

  return { run };
}

module.exports = {
  createJavaScriptToPythonTransmission,
};
