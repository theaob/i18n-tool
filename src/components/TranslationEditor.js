import { store } from '../store.js';
import { translationService } from '../services/translationService.js';

export function TranslationEditor() {
  const el = document.createElement('div');
  el.className = 'editor-area';

  let renderTimeout = null;

  function scheduleRender() {
    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(render, 30);
  }

  function render() {
    const locales = store.get('locales') || [];
    const baseLocale = store.get('baseLocale');
    const activeLocale = store.get('activeLocale');
    const selectedKey = store.get('selectedKey');

    if (!locales.length) {
      el.innerHTML = '';
      return;
    }

    const keys = translationService.getFilteredKeys();
    const stats = translationService.getStats();
    const base = locales.find(l => l.name === baseLocale);
    const active = locales.find(l => l.name === activeLocale);

    el.innerHTML = `
      <div class="editor-stats">
        <span>📋 ${stats.total} keys</span>
        ${baseLocale !== activeLocale ? `
          <span style="color:var(--success)">✓ ${stats.ok} translated</span>
          <span style="color:var(--danger)">⚠ ${stats.missing} missing</span>
          <span style="color:var(--warning)">≈ ${stats.untranslated} same as base</span>
        ` : ''}
        <span style="margin-left:auto;color:var(--text-muted)">${keys.length} shown</span>
      </div>
      <div class="table-wrapper">
        <table class="translation-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>${baseLocale || 'Base'} <span style="font-weight:400;text-transform:none;font-size:10px">(base)</span></th>
              <th>${activeLocale || 'Target'}</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="table-body"></tbody>
        </table>
      </div>
    `;

    const tbody = el.querySelector('#table-body');
    const fragment = document.createDocumentFragment();

    keys.forEach(key => {
      const baseVal = base?.data[key] ?? '';
      const activeVal = active?.data[key] ?? '';
      const status = baseLocale && activeLocale && baseLocale !== activeLocale
        ? translationService.getKeyStatus(key, baseLocale, activeLocale)
        : 'ok';

      const rowClass = status === 'missing' ? 'row-missing' : '';
      const isSelected = key === selectedKey;
      const badge = {
        ok: '<span class="badge badge-ok">✓</span>',
        missing: '<span class="badge badge-missing">✕</span>',
        untranslated: '<span class="badge badge-same">≈</span>',
      }[status];

      const tr = document.createElement('tr');
      tr.className = `${rowClass} ${isSelected ? 'selected' : ''}`;
      tr.dataset.key = key;
      tr.innerHTML = `
        <td class="td-key" title="${key}">${key}</td>
        <td class="td-value ${!baseVal ? 'empty' : ''}" title="${baseVal}">${baseVal || '—'}</td>
        <td class="td-value ${!activeVal ? 'empty' : ''}" title="${activeVal}">${activeVal || '—'}</td>
        <td class="td-status">${badge}</td>
      `;

      tr.addEventListener('click', () => {
        store.set('selectedKey', key);
        store.set('isDetailOpen', true);
      });

      fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
  }

  store.subscribe('locales', scheduleRender);
  store.subscribe('baseLocale', scheduleRender);
  store.subscribe('activeLocale', scheduleRender);
  store.subscribe('selectedKey', scheduleRender);
  store.subscribe('searchQuery', scheduleRender);
  store.subscribe('filterMode', scheduleRender);

  render();
  return el;
}
