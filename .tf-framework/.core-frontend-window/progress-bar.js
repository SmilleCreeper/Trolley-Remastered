const progressBar = {
  fill: null,
  status: null,
  previous: 0,
  startedAt: 0,
  label: '',
  finishTimer: null,
  resetTimer: null,

  init() {
    this.fill = document.getElementById('titlebar-fill');
    this.status = document.getElementById('titlebar-status');
    this.reset();
  },

  clearTimers() {
    if (this.finishTimer) {
      clearTimeout(this.finishTimer);
      this.finishTimer = null;
    }

    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  },

  show(label) {
    this.clearTimers();
    this.label = label || '';
    this.previous = 0;
    this.startedAt = Date.now();
    this.fill.style.width = '0%';
    this.fill.style.background = 'var(--progress-fill, #2a6b6b)';
    this.fill.style.opacity = '1';
    this.status.style.opacity = '1';
    this.updateText(0);
  },

  formatTime(milliseconds) {
    const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  },

  updateText(percent) {
    const elapsed = Date.now() - this.startedAt;
    let eta = '--';

    if (percent > 0) {
      const total = elapsed / (percent / 100);
      eta = this.formatTime(total - elapsed);
    }

    this.status.textContent = `${this.label} | Estimated Time: ${eta}`;
  },

  update(percent, message) {
    this.clearTimers();

    if (message !== undefined) {
      this.label = message;
    }

    const next = Math.min(100, Math.max(0, Number(percent) || 0));

    if (next > this.previous) {
      this.fill.style.background = 'var(--progress-fill-increase, #388e3c)';
    } else if (next < this.previous) {
      this.fill.style.background = 'var(--progress-fill-decrease, #d32f2f)';
    }

    this.fill.style.width = `${next}%`;
    this.previous = next;
    this.updateText(next);
  },

  finish(message) {
    if (message !== undefined) {
      this.label = message;
    }

    this.clearTimers();
    this.update(100, this.label);

    this.finishTimer = setTimeout(() => {
      this.finishTimer = null;
      this.hide();
    }, 500);
  },

  hide() {
    this.clearTimers();

    this.fill.style.opacity = '0';
    this.status.style.opacity = '0';

    this.resetTimer = setTimeout(() => {
      this.resetTimer = null;
      this.fill.style.width = '0%';
      this.previous = 0;
    }, 300);
  },

  reset() {
    if (!this.fill || !this.status) return;

    this.clearTimers();
    this.fill.style.width = '0%';
    this.fill.style.opacity = '0';
    this.fill.style.background = 'var(--progress-fill, #2a6b6b)';
    this.status.style.opacity = '0';
    this.status.textContent = '';
    this.previous = 0;
    this.startedAt = 0;
    this.label = '';
  },
};

module.exports = progressBar;
