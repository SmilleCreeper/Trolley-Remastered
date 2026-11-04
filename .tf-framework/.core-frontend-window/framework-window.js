const { ipcRenderer } = require('electron');
const brandbook = require('./brandbook.js');
const progressBar = require('./progress-bar.js');
const progressEvents = require('../.core-requests-endpoint/progress-events.js');
const screensEvents = require('../.core-requests-endpoint/screens-events.js');
const screenManager = require('../.core-backend-engine/application-screens-manager.js');

brandbook.apply();
progressBar.init();
progressEvents.attach(progressBar);

document.getElementById('btn-minimize').addEventListener('click', () => {
  ipcRenderer.send('window:minimize');
});

document.getElementById('btn-close').addEventListener('click', () => {
  ipcRenderer.send('window:close');
});

screensEvents.subscribe((screen, payload) => screenManager.mount(screen, payload));

screenManager
  .start(document.getElementById('screen-container'), {
    navigate: screensEvents.go,
    progress: progressEvents,
  })
  .catch((error) => {
    console.error('Failed to start the screen manager:', error);
  });
