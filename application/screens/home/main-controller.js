let context = null;
let queue = [];
let processing = false;
let keydownHandler = null;

function render(state) {
  const display = document.getElementById('calculator-display');
  const expression = document.getElementById('calculator-expression');
  const status = document.getElementById('calculator-status');

  if (display) display.textContent = state.display;
  if (expression) expression.textContent = state.expression;
  if (status) {
    status.textContent = state.status;
    status.classList.toggle('is-error', Boolean(state.statusIsError));
  }
}

function setKeypadDisabled(disabled) {
  const keypad = document.getElementById('calculator-keypad');
  if (!keypad) return;

  keypad.querySelectorAll('button').forEach((button) => {
    button.disabled = disabled;
  });
}

async function processQueue() {
  if (processing) return;

  processing = true;
  setKeypadDisabled(true);

  try {
    while (queue.length > 0) {
      if (!context || !context.isActive()) {
        queue = [];
        break;
      }

      const state = await context.python.run('calculator', queue.shift());

      if (!context || !context.isActive()) {
        queue = [];
        break;
      }

      if (state) render(state);
    }
  } catch (error) {
    queue = [];
    console.error('Calculator action failed:', error);
  } finally {
    processing = false;

    if (context && context.isActive()) setKeypadDisabled(false);
  }
}

function send(event) {
  if (!context || !context.isActive()) return;

  queue.push(event);
  void processQueue();
}

function handleKeypadClick(event) {
  const button = event.target.closest('button');

  if (!button || button.disabled) return;

  if (button.dataset.digit !== undefined) {
    send({ type: 'digit', value: button.dataset.digit });
  } else if (button.dataset.operator) {
    send({ type: 'operator', value: button.dataset.operator });
  } else if (button.dataset.action) {
    send({ type: 'action', value: button.dataset.action });
  }
}

function handleKeydown(event) {
  if (!context || !context.isActive()) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;

  if (
    event.target instanceof HTMLButtonElement &&
    (event.key === 'Enter' || event.key === ' ')
  ) {
    return;
  }

  if (
    event.key.length !== 1 &&
    !['Enter', 'Backspace', 'Escape'].includes(event.key)
  ) {
    return;
  }

  event.preventDefault();
  send({ type: 'key', value: event.key });
}

function mount(root, screenContext) {
  context = screenContext;
  queue = [];

  const keypad = document.getElementById('calculator-keypad');

  if (keypad) keypad.addEventListener('click', handleKeypadClick);

  keydownHandler = handleKeydown;
  document.addEventListener('keydown', keydownHandler);

  send({ type: 'reset' });
}

function unmount() {
  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler);
    keydownHandler = null;
  }

  context = null;
  queue = [];
}

module.exports = {
  mount,
  unmount,
};
