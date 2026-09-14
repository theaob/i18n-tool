import { store } from '../store.js';
import { translationService } from '../services/translationService.js';
import { aiService, isCode } from '../services/aiService.js';
import { Toast } from './Toast.js';

// Module-level variables to persist across re-creation of TranslationEditor component
const translatingLocales = {}; // { [localeName]: { current: number, total: number } }
let lastScrollTop = 0;
let lastScrollLeft = 0;

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
              ${orderedLocales.map(l => {
      if (l.name === baseLocale) {
        return `
                    <th class="th-locale">
                      ${l.name}
                      <span style="font-weight:400;text-transform:none;font-size:10px">(base)</span>
                    </th>
                  `;
      }
      const progress = translatingLocales[l.name];
      if (progress) {
        return `
                    <th class="th-locale">
                      ${l.name}
                      <button class="btn btn-ghost btn-sm btn-translate-all" data-locale="${l.name}" style="padding:0px 6px;margin-left:6px;font-size:10px" disabled>
                        <span class="spinner"></span> ${progress.current}/${progress.total}
                      </button>
                    </th>
                  `;
      }
      return `
                  <th class="th-locale">
                    ${l.name}
                    <button class="btn btn-ghost btn-sm btn-translate-all" data-locale="${l.name}" style="padding:0px 6px;margin-left:6px;font-size:10px" title="Translate all missing keys with AI">✨ Translate Missing</button>
                  </th>
                `;
    }).join('')}
            </tr>
          </thead>
          <tbody id="table-body"></tbody>
        </table>
      </div>
    `;

    const wrapper = el.querySelector('.table-wrapper');
    if (wrapper) {
      wrapper.addEventListener('scroll', () => {
        lastScrollTop = wrapper.scrollTop;
        lastScrollLeft = wrapper.scrollLeft;
      });
      requestAnimationFrame(() => {
        if (lastScrollTop !== undefined) wrapper.scrollTop = lastScrollTop;
        if (lastScrollLeft !== undefined) wrapper.scrollLeft = lastScrollLeft;
      });
    }

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
        if (!base) return;                              // no base selected
        if (translatingLocales[targetLocale]) return;   // already running

        // Locales don't always agree on which keys exist (one language's
        // file may simply be missing a key another has). When base itself
        // lacks a key, fall back through the rest in a fixed priority:
        // base itself, then EN > TR > AZ, then whatever else is loaded.
        const priorityNames = [baseLocale, 'EN', 'TR', 'AZ', ...locales.map(l => l.name)]
            .filter((name, idx, arr) => name && name !== targetLocale && arr.indexOf(name) === idx);
        const sourceLocalesInOrder = priorityNames
            .map(name => locales.find(l => l.name === name))
            .filter(Boolean);

        const missingKeys = keys.filter(
            key => translationService.getKeyStatus(key, baseLocale, targetLocale) === 'missing'
        );
        const numMissing = missingKeys.length;
        if (numMissing === 0) {
          Toast.info(`No missing keys for ${targetLocale}`);
          return;
        }

        // For each missing key, grab source text from the first locale in
        // priority order that actually has a non-empty value, and group by
        // that locale so each group can be translated with the right
        // source language.
        const missingEntries = {}; // flat key -> source text, for the code count below
        const entriesBySourceLang = new Map(); // sourceLocaleName -> { key: text }
        for (const key of missingKeys) {
          const sourceLocale = sourceLocalesInOrder.find(l => (l.data[key] || '').trim());
          if (!sourceLocale) continue; // no locale has any text for this key at all
          missingEntries[key] = sourceLocale.data[key];
          if (!entriesBySourceLang.has(sourceLocale.name)) entriesBySourceLang.set(sourceLocale.name, {});
          entriesBySourceLang.get(sourceLocale.name)[key] = sourceLocale.data[key];
        }

        const numTranslatable = Object.keys(missingEntries).length;
        if (numTranslatable === 0) {
          Toast.warning(`None of the ${numMissing} missing keys for ${targetLocale} have source text in any loaded locale`);
          return;
        }

        // How many will actually reach the API — standard codes are copied as-is
        const numCodes = Object.entries(missingEntries)
            .filter(([k, v]) => isCode(v, k)).length;
        const numAI = numTranslatable - numCodes;
        const numNoSource = numMissing - numTranslatable;
        const noSourceNote = numNoSource > 0
            ? ` ${numNoSource} have no source text in any loaded locale and will be skipped.`
            : '';

        const detail = numCodes > 0
            ? `${numMissing} missing keys for ${targetLocale}: ${numCodes} are standard codes and will be copied as-is, ${numAI} will be translated with AI.${noSourceNote}`
            : `Translate ${numTranslatable} missing keys for ${targetLocale} with AI?${noSourceNote}`;
        if (!confirm(`${detail} Continue?`)) return;

        translatingLocales[targetLocale] = { current: 0, total: numTranslatable };
        scheduleRender();

        try {
          let doneSoFar = 0;
          const translated = {};
          // One batchTranslate call per source language, so each group is
          // translated FROM the language it actually came from.
          for (const [sourceLang, entries] of entriesBySourceLang) {
            const groupTotal = Object.keys(entries).length;
            const groupResult = await aiService.batchTranslate(
                entries,
                sourceLang,
                targetLocale,
                {
                  chunkSize: 50,
                  onProgress: (done) => {
                    if (translatingLocales[targetLocale]) {
                      translatingLocales[targetLocale].current = doneSoFar + done;
                      scheduleRender();
                    }
                  },
                  // Apply each chunk (and the instant code/cache hits) to the
                  // store as soon as it lands, so translated rows appear
                  // progressively instead of all popping in at the very end.
                  onChunk: (partial) => {
                    const toApply = Object.fromEntries(
                        Object.entries(partial).filter(([, value]) => value)
                    );
                    if (Object.keys(toApply).length > 0) {
                      translationService.updateTranslations(targetLocale, toApply);
                    }
                  },
                }
            );
            Object.assign(translated, groupResult);
            doneSoFar += groupTotal;
          }

          const completed = Object.values(translated).filter(Boolean).length;

          if (completed === numMissing) {
            Toast.success(`Successfully translated ${completed} keys to ${targetLocale}`);
          } else {
            Toast.info(`Translated ${completed} of ${numMissing} keys to ${targetLocale}`);
          }
        } catch (err) {
          Toast.error(err.message);
        } finally {
          delete translatingLocales[targetLocale];
          // Trigger a global re-render to restore button state
          store.set('locales', [...store.get('locales')]);
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