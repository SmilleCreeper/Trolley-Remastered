const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const manifest = require('../../.tf-framework/.core-requests-endpoint/manifest-events.js');
const permissionsCheck = require('../../.tf-framework/.core-backend-engine/javascript-to-python-permissions.js');
const py = require('../../.tf-framework/.core-orchestration-base/python-engine-orchestrator.js');
const {
  createJavaScriptToPythonTransmission,
} = require('../../.tf-framework/.core-orchestration-base/javascript_to_python_transmission.js');

const keepAlive = setInterval(() => {}, 1000);

async function main() {
  const version = py.evalSync({}, '__import__("sys").version.split()[0]');
  const bridge = py.evalSync({}, '__import__("python_to_framework_bridge").__name__');

  if (bridge !== 'python_to_framework_bridge') {
    throw new Error('python_to_framework_bridge did not load through the embedded Python runtime.');
  }

  const home = manifest.get('defaultScreen', 'home');
  const fallback = manifest.get('fallbackScreen', 'fallback');
  const modelDirectory = path.join(root, 'application', 'model', 'python');
  const actionPath = path.join(modelDirectory, 'calculator.py');

  if (!fs.existsSync(actionPath)) {
    throw new Error(`The calculator action was not found at ${actionPath}.`);
  }

  const progress = {
    show() {},
    update() {},
    finish() {},
    hide() {},
    reset() {},
  };

  const actions = createJavaScriptToPythonTransmission({
    screen: home,
    modelDirectory,
    progress,
    navigate: async () => {},
    isActive: () => true,
  });

  let state = await actions.run('calculator', { type: 'reset' });
  state = await actions.run('calculator', { type: 'digit', value: '1' });
  state = await actions.run('calculator', { type: 'operator', value: '+' });
  state = await actions.run('calculator', { type: 'digit', value: '1' });
  state = await actions.run('calculator', {
    type: 'action',
    value: 'equals',
  });

  if (!state || state.display !== '2') {
    throw new Error('The calculator action did not return the expected state.');
  }

  let denied = false;

  try {
    await createJavaScriptToPythonTransmission({
      screen: fallback,
      modelDirectory,
      progress,
      navigate: async () => {},
      isActive: () => true,
    }).run('calculator', { type: 'reset' });
  } catch (error) {
    denied = /not allowed/.test(error.message);
  }

  if (!denied) {
    throw new Error('The calculator restriction did not block the fallback screen.');
  }

  let navigated = null;

  await createJavaScriptToPythonTransmission({
    screen: fallback,
    modelDirectory,
    progress,
    navigate: async (screen, payload) => {
      navigated = { screen, payload };
    },
    isActive: () => true,
  }).run('return_to_home_screen');

  if (!navigated || navigated.screen !== home) {
    throw new Error('The fallback action did not navigate back to the home screen.');
  }

  if (!permissionsCheck.canAccess('not_defined.py', fallback)) {
    throw new Error('An action without a permission rule should remain unrestricted.');
  }

  console.log(
    `[setup-check] Embedded Python ${version}, node-calls-python, ` +
      'manifest bridge, model actions, and screen permissions are working.',
  );
}

main()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error(`[setup-check] ${error.stack || error.message}`);
    process.exitCode = 1;
  })
  .finally(() => {
    clearInterval(keepAlive);
  });
