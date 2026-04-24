export function Modal({ title, body, footer, onClose }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal__header">
        <h3>${title}</h3>
        <button class="btn-icon" id="modal-close-btn" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="modal__body"></div>
      ${footer ? '<div class="modal__footer"></div>' : ''}
    </div>
  `;

  const bodyEl = overlay.querySelector('.modal__body');
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else bodyEl.appendChild(body);

  if (footer) {
    const footerEl = overlay.querySelector('.modal__footer');
    if (typeof footer === 'string') footerEl.innerHTML = footer;
    else footerEl.appendChild(footer);
  }

  overlay.querySelector('#modal-close-btn').addEventListener('click', () => {
    close();
    onClose?.();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) { close(); onClose?.(); }
  });

  document.addEventListener('keydown', handleEscape);
  function handleEscape(e) {
    if (e.key === 'Escape') { close(); onClose?.(); }
  }

  function close() {
    document.removeEventListener('keydown', handleEscape);
    overlay.remove();
  }

  document.body.appendChild(overlay);
  return { close, overlay };
}
