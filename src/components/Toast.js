let container;

function getContainer() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

export const Toast = {
  show({ message, type = 'info', duration = 3500 }) {
    const c = getContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    toast.innerHTML = `<span style="font-size:15px">${icons[type] || 'ℹ'}</span><span>${message}</span>`;

    c.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 300ms ease, transform 300ms ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success(message) { this.show({ message, type: 'success' }); },
  error(message) { this.show({ message, type: 'error', duration: 5000 }); },
  info(message) { this.show({ message, type: 'info' }); },
  warning(message) { this.show({ message, type: 'warning' }); },
};
