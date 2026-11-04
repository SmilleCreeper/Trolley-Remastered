const fs = require('fs');
const path = require('path');

const manifest = require('../.core-requests-endpoint/manifest-events.js');
const {
  createJavaScriptToPythonTransmission,
} = require('../.core-orchestration-base/javascript_to_python_transmission.js');

const screensRoot = path.resolve(__dirname, '..', '..', 'application', 'screens');
const modelDirectory = path.resolve(
  __dirname,
  '..',
  '..',
  'application',
  'model',
  'python',
);
const defaultScreen = manifest.get('defaultScreen', 'home');
const fallbackScreen = manifest.get('fallbackScreen', 'fallback');

let container = null;
let options = null;
let currentScreen = null;
let currentStyle = null;
let currentModule = null;
let mountToken = 0;

function assertScreenName(name) {
  if (typeof name !== 'string' || !/^[a-z0-9_-]+$/i.test(name)) {
    throw new Error(`Invalid screen name: ${name}`);
  }
}

function clearScreen() {
  if (currentModule && typeof currentModule.unmount === 'function') {
    try {
      currentModule.unmount();
    } catch (error) {
      console.error(`Failed to unmount screen "${currentScreen}":`, error);
    }
  }

  if (currentStyle) {
    currentStyle.remove();
  }

  if (container) {
    container.innerHTML = '';
  }

  if (options && options.progress) {
    options.progress.reset();
  }

  currentScreen = null;
  currentStyle = null;
  currentModule = null;
}

function fallbackPayload() {
  return {
    cause: 'Screen failed to load',
    description: 'The screen manager could not load the requested screen files.',
  };
}

async function loadScreen(name, payload, isFallback) {
  assertScreenName(name);

  const token = ++mountToken;
  const screenDirectory = path.join(screensRoot, name);
  const htmlPath = path.join(screenDirectory, 'index-view.html');
  const stylePath = path.join(screenDirectory, 'style-view.css');
  const mainPath = path.join(screenDirectory, 'main-controller.js');

  try {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const css = fs.readFileSync(stylePath, 'utf8');

    if (token !== mountToken) return null;

    clearScreen();

    container.innerHTML = html;

    const style = document.createElement('style');
    style.dataset.screen = name;
    style.textContent = css;
    document.head.appendChild(style);
    currentStyle = style;

    delete require.cache[require.resolve(mainPath)];
    const screenModule = require(mainPath);
    currentModule = screenModule;
    currentScreen = name;

    const isActive = () => token === mountToken;

    const screenContext = {
      screen: name,
      payload,
      isActive,
      python: createJavaScriptToPythonTransmission({
        screen: name,
        modelDirectory,
        progress: options.progress,
        navigate: options.navigate,
        isActive,
      }),
    };

    if (typeof screenModule.mount === 'function') {
      await screenModule.mount(container, screenContext);
    } else if (typeof screenModule === 'function') {
      await screenModule(container, screenContext);
    }

    return screenModule;
  } catch (error) {
    if (isFallback) {
      throw error;
    }

    console.error(`Failed to load screen "${name}":`, error);
    return loadScreen(fallbackScreen, fallbackPayload(), true);
  }
}

async function mount(name, payload) {
  if (!container) {
    throw new Error('Screen manager has not been started.');
  }

  return loadScreen(name || defaultScreen, payload, false);
}

async function start(root, startOptions) {
  if (!root || !(root instanceof HTMLElement)) {
    throw new TypeError('Screen manager requires a container element.');
  }

  if (!startOptions || typeof startOptions.navigate !== 'function') {
    throw new TypeError('Screen manager requires a navigate function.');
  }

  if (!startOptions.progress || typeof startOptions.progress.update !== 'function') {
    throw new TypeError('Screen manager requires the progress endpoint.');
  }

  container = root;
  options = startOptions;

  return mount(defaultScreen);
}

module.exports = {
  start,
  mount,
};
