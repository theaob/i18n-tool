import { store } from '../store.js';
import { translationService } from '../services/translationService.js';
import { exportService } from '../services/exportService.js';
import { Toast } from './Toast.js';
import { Modal } from './Modal.js';

export function Toolbar() {
  const el = document.createElement('div');
  el.className = 'toolbar';

  function render() {
    const mode = store.get('filterMode') || 'all';
    const query = store.get('searchQuery') || '';
    const locales = store.get('locales') || [];
    const activeLocale = store.get('activeLocale');
    const hasLocales = locales.length > 0;

    el.innerHTML = `
      <div class="toolbar__search">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" id="search-input" placeholder="Search keys or values… ⌘K"
          value="${query}" ${!hasLocales ? 'disabled' : ''} />
      </div>

      <div class="toolbar__filters">
        <button class="chip ${mode === 'all' ? 'active' : ''}" data-mode="all">All</button>
        <button class="chip ${mode === 'missing' ? 'active warning' : ''}" data-mode="missing">Missing</button>
        <button class="chip ${mode === 'untranslated' ? 'active warning' : ''}" data-mode="untranslated">Same as base</button>
      </div>

      <div class="toolbar__spacer"></div>

      <div class="toolbar__actions">
        <button class="btn btn-secondary btn-sm" id="add-key-btn" ${!hasLocales ? 'disabled' : ''} title="Add key (⌘N)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Key
        </button>

        <div style="position:relative">
          <button class="btn btn-secondary btn-sm" id="export-btn" ${!hasLocales ? 'disabled' : ''} title="Export (⌘E)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
          </button>
          <div class="export-menu hidden" id="export-menu" style="
            position:absolute; right:0; top:calc(100% + 4px); z-index:100;
            background:var(--bg-surface); border:1px solid var(--border);
            border-radius:var(--radius-md); box-shadow:var(--shadow-md);
            min-width:160px; overflow:hidden;">
            <button class="export-menu-item" data-export="json" style="
              display:flex;align-items:center;gap:8px;width:100%;padding:10px 14px;
              background:none;border:none;cursor:pointer;font-size:13px;color:var(--text-primary);
              transition:background var(--transition);">
              📄 Save File
            </button>
            <div class="divider"></div>
            <button class="export-menu-item" data-export="csv" style="
              display:flex;align-items:center;gap:8px;width:100%;padding:10px 14px;
              background:none;border:none;cursor:pointer;font-size:13px;color:var(--text-primary);
              transition:background var(--transition);">
              📊 Export CSV (all locales)
            </button>
          </div>
        </div>
      </div>
    `;

    // Search
    const searchInput = el.querySelector('#search-input');
    searchInput.addEventListener('input', (e) => {
      store.set('searchQuery', e.target.value);
    });

    // Filter chips
    el.querySelectorAll('.chip[data-mode]').forEach(chip => {
      chip.addEventListener('click', () => store.set('filterMode', chip.dataset.mode));
    });

    // Add key
    el.querySelector('#add-key-btn')?.addEventListener('click', showAddKeyModal);

    // Export menu
    const exportBtn = el.querySelector('#export-btn');
    const exportMenu = el.querySelector('#export-menu');
    exportBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      exportMenu.classList.toggle('hidden');
    });
    document.addEventListener('click', () => exportMenu?.classList.add('hidden'));

    el.querySelectorAll('.export-menu-item').forEach(item => {
      item.addEventListener('mouseenter', () => item.style.background = 'var(--bg-hover)');
      item.addEventListener('mouseleave', () => item.style.background = '');
      item.addEventListener('click', async () => {
        exportMenu.classList.add('hidden');
        const type = item.dataset.export;
        try {
          if (type === 'json') {
            const locales = store.get('locales') || [];
            const locale = locales.find(l => l.name === activeLocale);
            const format = locale?.meta?.format || 'json';
            const result = await exportService.exportJson(activeLocale);
            if (result?.success) Toast.success(`Saved ${activeLocale}.${format}`);
          } else if (type === 'csv') {
            const result = await exportService.exportCsv();
            if (result?.success) Toast.success('Exported CSV');
          }
        } catch (err) {
          Toast.error(err.message);
        }
      });
    });
  }

  function showAddKeyModal() {
    const body = document.createElement('div');
    body.className = 'form-group';
    body.innerHTML = `
      <label for="new-key-input">Key name (use dots for nesting, e.g. <code>auth.login.title</code>)</label>
      <input type="text" id="new-key-input" class="form-input" placeholder="my.translation.key" />
    `;

    const footer = document.createElement('div');
    footer.style.display = 'flex'; footer.style.gap = '8px';
    footer.innerHTML = `
      <button class="btn btn-secondary" id="cancel-add">Cancel</button>
      <button class="btn btn-primary" id="confirm-add">Add Key</button>
    `;

    const { close } = Modal({ title: 'Add Translation Key', body, footer });

    footer.querySelector('#cancel-add').addEventListener('click', close);
    footer.querySelector('#confirm-add').addEventListener('click', () => {
      const key = body.querySelector('#new-key-input').value.trim();
      if (!key) return;
      translationService.addKey(key);
      store.set('selectedKey', key);
      store.set('isDetailOpen', true);
      Toast.success(`Added key: ${key}`);
      close();
    });

    setTimeout(() => body.querySelector('#new-key-input').focus(), 100);
  }

  store.subscribe('filterMode', render);
  store.subscribe('searchQuery', render);
  store.subscribe('locales', render);
  render();
  return el;
}
