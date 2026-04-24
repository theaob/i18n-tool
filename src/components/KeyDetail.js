import { store } from '../store.js';
import { translationService } from '../services/translationService.js';
import { aiService } from '../services/aiService.js';
import { Toast } from './Toast.js';

export function KeyDetail() {
  const el = document.createElement('div');
  el.className = 'detail-panel';

  let translatingLocale = null;

  function render() {
    const key = store.get('selectedKey');
    const locales = store.get('locales') || [];
    const baseLocale = store.get('baseLocale');

    if (!key) {
      el.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;padding:32px;text-align:center;color:var(--text-muted);font-size:13px">
          Select a translation key to view and edit it here.
        </div>`;
      return;
    }

    const baseLocaleObj = locales.find(l => l.name === baseLocale);
    const baseVal = baseLocaleObj?.data[key] ?? '';

    el.innerHTML = `
      <div class="detail-panel__header">
        <div class="detail-panel__key">${key}</div>
        <button class="btn-icon" id="detail-close" title="Close panel">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="detail-panel__body" id="detail-body">
        ${locales.map(locale => {
          const val = locale.data[key] ?? '';
          const isBase = locale.name === baseLocale;
          return `
            <div class="detail-locale-block" data-locale="${locale.name}">
              <div class="detail-locale-label ${isBase ? 'base' : ''}">
                ${locale.name}${isBase ? ' <span style="opacity:.6;font-weight:400;text-transform:none">(base)</span>' : ''}
              </div>
              <textarea class="detail-textarea" data-locale="${locale.name}" rows="3">${val}</textarea>
              ${!isBase ? `
                <div class="detail-ai-row">
                  <button class="btn btn-secondary btn-sm ai-translate-btn" data-locale="${locale.name}"
                    title="Translate using Gemini AI" style="gap:6px">
                    <span class="ai-btn-inner-${locale.name}">✨ AI Translate</span>
                  </button>
                  <button class="btn btn-ghost btn-sm copy-base-btn" data-locale="${locale.name}" title="Copy base value">
                    Copy base
                  </button>
                </div>
              ` : ''}
              ${val && val.includes('<') ? `
                <div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-top:4px">Preview</div>
                <div class="detail-preview">${val}</div>
              ` : ''}
            </div>
          `;
        }).join('<div class="divider"></div>')}
      </div>
      <div class="detail-panel__footer">
        <button class="btn btn-danger btn-sm" id="delete-key-btn">Delete key</button>
      </div>
    `;

    // Close
    el.querySelector('#detail-close').addEventListener('click', () => {
      store.set('isDetailOpen', false);
      store.set('selectedKey', null);
    });

    // Textarea changes
    el.querySelectorAll('.detail-textarea').forEach(ta => {
      ta.addEventListener('change', () => {
        translationService.updateTranslation(ta.dataset.locale, key, ta.value);
      });
      ta.addEventListener('input', () => {
        // Live preview
        const block = ta.closest('.detail-locale-block');
        const preview = block?.querySelector('.detail-preview');
        if (preview) preview.innerHTML = ta.value;
      });
    });

    // AI translate
    el.querySelectorAll('.ai-translate-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const targetLocale = btn.dataset.locale;
        if (translatingLocale) return;
        translatingLocale = targetLocale;
        const inner = btn.querySelector(`.ai-btn-inner-${targetLocale}`);
        inner.innerHTML = '<span class="spinner"></span> Translating…';
        btn.disabled = true;

        try {
          const translated = await aiService.translate(baseVal, baseLocale, targetLocale);
          translationService.updateTranslation(targetLocale, key, translated);
          const ta = el.querySelector(`.detail-textarea[data-locale="${targetLocale}"]`);
          if (ta) ta.value = translated;
          Toast.success(`Translated to ${targetLocale}`);
        } catch (err) {
          Toast.error(err.message);
        } finally {
          translatingLocale = null;
          inner.innerHTML = '✨ AI Translate';
          btn.disabled = false;
        }
      });
    });

    // Copy base
    el.querySelectorAll('.copy-base-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const locale = btn.dataset.locale;
        translationService.updateTranslation(locale, key, baseVal);
        const ta = el.querySelector(`.detail-textarea[data-locale="${locale}"]`);
        if (ta) ta.value = baseVal;
      });
    });

    // Delete key
    el.querySelector('#delete-key-btn').addEventListener('click', () => {
      if (confirm(`Delete key "${key}" from all locales?`)) {
        translationService.deleteKey(key);
        Toast.success(`Deleted key: ${key}`);
      }
    });
  }

  store.subscribe('selectedKey', render);
  store.subscribe('locales', render);
  render();
  return el;
}
