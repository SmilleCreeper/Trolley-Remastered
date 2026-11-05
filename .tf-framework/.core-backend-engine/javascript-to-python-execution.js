const path = require('path');

const py = require('../.core-orchestration-base/python-engine-orchestrator.js');
const manifestEvents = require('../.core-requests-endpoint/manifest-events.js');

function conciseError(error) {
  const text = error && error.message ? error.message : String(error);
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  return lines[lines.length - 1] || 'Python action failed.';
}

function normalizeActionName(file) {
  if (typeof file !== 'string' || file.trim() === '') {
    throw new TypeError('Python action file name is required.');
  }

  const fileName = file.trim().endsWith('.py')
    ? file.trim()
    : `${file.trim()}.py`;

  if (path.basename(fileName) !== fileName) {
    throw new TypeError(
      'Python action must be a file name inside the model python folder.',
    );
  }

  return fileName;
}

// node-calls-python derives a module handler id from the Python module pointer
// and a process-wide random value. Importing the same file again can mint the
// same id, and when the older JavaScript handler is garbage collected its
// finalizer removes that shared id from the native handler table. Cache one
// handler per module file for the lifetime of the renderer so screen remounts
// reuse it instead of invalidating each other.
const pythonModules = new Map();

function importPythonModule(modulePath) {
  const cached = pythonModules.get(modulePath);

  if (cached) return cached;

  const importPromise = py.import(modulePath).catch((error) => {
    if (pythonModules.get(modulePath) === importPromise) {
      pythonModules.delete(modulePath);
    }

    throw error;
  });

  pythonModules.set(modulePath, importPromise);
  return importPromise;
}

function createJavaScriptToPythonExecution({
  modelDirectory,
  progress,
  navigate,
  isActive,
}) {
  if (typeof modelDirectory !== 'string' || modelDirectory.trim() === '') {
    throw new TypeError('Python actions require a model directory.');
  }

  function createEventHandler(onNavigate) {
    return function handleEvent(event, data) {
      if (!isActive()) return;

      const payload = data || {};

      try {
        switch (event) {
          case 'progress.show':
            progress.show(payload.label);
            break;
          case 'progress.update':
            progress.update(
              payload.percent,
              payload.message === null ? undefined : payload.message,
            );
            break;
          case 'progress.finish':
            progress.finish(
              payload.message === null ? undefined : payload.message,
            );
            break;
          case 'progress.hide':
            progress.hide();
            break;
          case 'progress.reset':
            progress.reset();
            break;
          case 'screens.go':
            onNavigate({
              screen: payload.screen,
              payload: payload.payload,
            });
            break;
          default:
            console.error(`Unknown Python action event: ${event}`);
            break;
        }
      } catch (error) {
        console.error(`Failed to handle Python action event "${event}":`, error);
      }
    };
  }

  async function run(file, payload = {}) {
    if (!isActive()) return undefined;

    const fileName = normalizeActionName(file);
    const modulePath = path.join(modelDirectory, fileName);
    let navigation = null;
    const handleEvent = createEventHandler((value) => {
      navigation = value;
    });

    let result;

    try {
      const module = await importPythonModule(modulePath);

      result = await py.call(
        module,
        'run',
        payload,
        handleEvent,
        manifestEvents.all(),
      );
    } catch (error) {
      console.error(`Python action "${fileName}" failed:`, error);

      const message = conciseError(error);
      const hint = /takes \d+ positional arguments? but \d+ were given/.test(
        message,
      )
        ? ' Python actions must use the @action decorator.'
        : '';

      const wrapped = new Error(`${message}${hint}`);
      wrapped.cause = error;
      throw wrapped;
    }

    if (!isActive()) return undefined;

    if (navigation) {
      await navigate(navigation.screen, navigation.payload);
      return undefined;
    }

    return result;
  }

  return { run };
}

module.exports = {
  createJavaScriptToPythonExecution,
};
