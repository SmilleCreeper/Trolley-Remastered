let context = null;

async function mount(root, screenContext) {
  context = screenContext;

  const causeElement = document.getElementById('fallback-cause');
  const descriptionElement = document.getElementById('fallback-description');
  const detailsElement = document.getElementById('fallback-details');
  const returnButton = document.getElementById('fallback-btn');
  const payload = screenContext.payload || {};
  const details = payload.details ? String(payload.details) : '';

  causeElement.textContent = payload.cause || 'Something went wrong';
  descriptionElement.textContent =
    payload.description || 'No details available.';
  detailsElement.textContent = details;
  detailsElement.hidden = !details;

  returnButton.addEventListener('click', async () => {
    returnButton.disabled = true;

    try {
      await context.python.run('return_to_home_screen');
    } catch (error) {
      if (!context.isActive()) return;

      returnButton.disabled = false;
      descriptionElement.textContent = `Python error: ${error.message || error}`;
    }
  });
}

function unmount() {}

module.exports = {
  mount,
  unmount,
};
