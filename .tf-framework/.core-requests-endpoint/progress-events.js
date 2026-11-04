let progressBar = null;

function attach(bar) {
  progressBar = bar;
}

function show(label) {
  if (progressBar) progressBar.show(label);
}

function update(percent, message) {
  if (progressBar) progressBar.update(percent, message);
}

function finish(message) {
  if (progressBar) progressBar.finish(message);
}

function hide() {
  if (progressBar) progressBar.hide();
}

function reset() {
  if (progressBar) progressBar.reset();
}

module.exports = {
  attach,
  show,
  update,
  finish,
  hide,
  reset,
};
