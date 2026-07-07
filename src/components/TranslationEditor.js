import { store } from '../store.js';
import { translationService } from '../services/translationService.js';
import { aiService } from '../services/aiService.js';
import { Toast } from './Toast.js';

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
    const selectedKey = store.get('selectedKey');

    if (!locales.length) {
      el.innerHTML = '';
      return;
    }

    const keys = translationService.getFilteredKeys();
    const stats = translationService.getStats();
    const base = locales.find(l => l.name === baseLocale);

    // Order locales: base first, then the rest
    const orderedLocales = [];
    if (base) orderedLocales.push(base);
    locales.forEach(l => { if (l.name !== baseLocale) orderedLocales.push(l); });

    // Determine if we need feature grouping
    const hasFeatureGroups = locales.some(l => l.sourceFiles);

    // Count total columns: key + N locales
    const colCount = 1 + orderedLocales.length;

    el.innerHTML = `
      <div class="editor-stats">
        <span>📋 ${stats.total} keys</span>
        <span style="color:var(--success)">✓ ${stats.ok} translated</span>
        <span style="color:var(--danger)">⚠ ${stats.missing} missing</span>
        <span style="color:var(--warning)">≈ ${stats.untranslated} same as base</span>
        <span style="margin-left:auto;color:var(--text-muted)">${keys.length} shown</span>
      </div>
      <div class="table-wrapper">
        <table class="translation-table translation-table--multi">
          <thead>
            <tr>
              <th class="th-key">Key</th>
              ${orderedLocales.map((l, i) => `
                <th class="th-locale">
                  ${l.name}
                  ${l.name === baseLocale 
                    ? ' <span style="font-weight:400;text-transform:none;font-size:10px">(base)</span>' 
                    : ` <button class="btn btn-ghost btn-sm btn-translate-all" data-locale="${l.name}" style="padding:0px 6px;margin-left:6px;font-size:10px" title="Translate all missing keys with AI">✨ Translate Missing</button>`}
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody id="table-body"></tbody>
        </table>
      </div>
    `;

    const tbody = el.querySelector('#table-body');
    const fragment = document.createDocumentFragment();

    let lastFeature = null;

    keys.forEach(key => {
      // Insert feature group header if needed
      if (hasFeatureGroups) {
        const dotIdx = key.indexOf('.');
        const feature = dotIdx > 0 ? key.slice(0, dotIdx) : null;
        if (feature && feature !== lastFeature) {
          lastFeature = feature;
          const headerTr = document.createElement('tr');
          headerTr.className = 'feature-group-header';
          const featureKeys = keys.filter(k => k.startsWith(`${feature}.`));

          // Count missing across all non-base locales
          let totalMissing = 0;
          if (base) {
            orderedLocales.forEach(l => {
              if (l.name !== baseLocale) {
                totalMissing += featureKeys.filter(k =>
                  translationService.getKeyStatus(k, baseLocale, l.name) === 'missing'
                ).length;
              }
            });
          }

          headerTr.innerHTML = `
            <td colspan="${colCount}" class="feature-group-cell">
              <span class="feature-group-name">📁 ${feature}</span>
              <span class="feature-group-count">${featureKeys.length} keys</span>
              ${totalMissing > 0 ? `<span class="feature-group-missing">⚠ ${totalMissing} missing</span>` : ''}
            </td>
          `;
          fragment.appendChild(headerTr);
        }
      }

      // Show the display key (strip feature prefix for grouped views)
      const displayKey = hasFeatureGroups && key.indexOf('.') > 0
        ? key.slice(key.indexOf('.') + 1)
        : key;

      // Determine if any non-base locale is missing this key
      const hasMissing = base && orderedLocales.some(l =>
        l.name !== baseLocale && translationService.getKeyStatus(key, baseLocale, l.name) === 'missing'
      );

      const isSelected = key === selectedKey;

      const tr = document.createElement('tr');
      tr.className = `${hasMissing ? 'row-missing' : ''} ${isSelected ? 'selected' : ''}`;
      tr.dataset.key = key;

      // Build cells: key + one cell per locale
      let cells = `<td class="td-key" title="${key}">${displayKey}</td>`;
      orderedLocales.forEach(l => {
        const val = l.data[key] ?? '';
        const isBase = l.name === baseLocale;
        const isEmpty = !val;
        const isSameAsBase = !isBase && base && val && val === base.data[key];

        let cellClass = 'td-value';
        if (isEmpty && !isBase) cellClass += ' empty cell-missing';
        else if (isEmpty) cellClass += ' empty';
        else if (isSameAsBase) cellClass += ' cell-same';

        cells += `<td class="${cellClass}" title="${val}">${val || '—'}</td>`;
      });

      tr.innerHTML = cells;
      tr.addEventListener('click', () => {
        store.set('selectedKey', key);
        store.set('isDetailOpen', true);
      });

      fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);

    // Batch translate listeners
    el.querySelectorAll('.btn-translate-all').forEach(btn => {
      btn.addEventListener('click', async () => {
        const targetLocale = btn.dataset.locale;
        
        // Find missing keys
        const missingEntries = {};
        keys.forEach(key => {
          if (translationService.getKeyStatus(key, baseLocale, targetLocale) === 'missing') {
            missingEntries[key] = base.data[key];
          }
        });

        const numMissing = Object.keys(missingEntries).length;
        if (numMissing === 0) {
          Toast.info(`No missing keys for ${targetLocale}`);
          return;
        }

        if (!confirm(`Translate ${numMissing} missing keys for ${targetLocale} with AI? This may take a moment.`)) return;

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Translating...';

        try {
          const results = await aiService.batchTranslate(missingEntries, baseLocale, targetLocale);
          // Update translations
          Object.entries(results).forEach(([k, v]) => {
            translationService.updateTranslation(targetLocale, k, v);
          });
          Toast.success(`Successfully translated ${numMissing} keys to ${targetLocale}`);
        } catch (err) {
          Toast.error(err.message);
        } finally {
          scheduleRender();
        }
      });
    });
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
