const listeners = new Set();

function subscribe(listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('Screen event listener must be a function.');
  }

  listeners.add(listener);

  return function unsubscribe() {
    listeners.delete(listener);
  };
}

async function go(screen, payload) {
  if (typeof screen !== 'string' || screen.trim() === '') {
    throw new TypeError('Screen name is required.');
  }

  const results = [];

  for (const listener of listeners) {
    results.push(listener(screen, payload));
  }

  return Promise.all(results);
}

module.exports = {
  subscribe,
  go,
};
