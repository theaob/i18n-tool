import { store } from '../store.js';
import { fileService } from '../services/fileService.js';
import { Toast } from './Toast.js';
import { Modal } from './Modal.js';

// Locale name → flag emoji mapping (common ones)
const FLAGS = {
  en: '🇬🇧', 'en-us': '🇺🇸', 'en-gb': '🇬🇧',
  tr: '🇹🇷', de: '🇩🇪', fr: '🇫🇷', es: '🇪🇸',
  it: '🇮🇹', pt: '🇵🇹', 'pt-br': '🇧🇷', ru: '🇷🇺',
  ja: '🇯🇵', ko: '🇰🇷', zh: '🇨🇳', ar: '🇸🇦',
  nl: '🇳🇱', pl: '🇵🇱', sv: '🇸🇪', da: '🇩🇰',
};

function getFlag(name) {
  return FLAGS[name.toLowerCase()] || '🌐';
}

export function Sidebar(onNavigate) {
  const el = document.createElement('aside');
  el.className = 'sidebar';

  function render() {
    const locales = store.get('locales') || [];
    const activeLocale = store.get('activeLocale');
    const baseLocale = store.get('baseLocale');

    el.innerHTML = `
      <div class="sidebar__header">
        <span>Locales</span>
        <div style="display:flex;gap:4px">
          <button class="btn-icon" id="create-locale-btn" title="Create new locale" ${locales.length === 0 ? 'disabled' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <button class="btn-icon" id="open-files-btn" title="Open locale files (⌘O)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
        </div>
      </div>
      ${locales.length > 0 ? `
        <div class="sidebar__base-selector">
          <label for="base-locale-select">Base locale</label>
          <select id="base-locale-select" class="form-select-sm">
            ${locales.map(l => `
              <option value="${l.name}" ${l.name === baseLocale ? 'selected' : ''}>${getFlag(l.name)} ${l.name}</option>
            `).join('')}
          </select>
        </div>
      ` : ''}
      <div class="sidebar__list" id="locale-list">
        ${locales.length === 0 ? `
          <div class="sidebar__empty">
            No files open.<br/>Click the folder icon or drag & drop locale files here.
          </div>
        ` : locales.map(l => {
          const count = Object.keys(l.data).length;
          const isBase = l.name === baseLocale;
          const fileCount = l.sourceFiles ? l.sourceFiles.length : 0;
          return `
            <div class="sidebar__item ${l.name === activeLocale ? 'active' : ''}"
                 data-locale="${l.name}" title="${l.path || l.name}">
              <span class="locale-flag">${getFlag(l.name)}</span>
              <span class="locale-name">${l.name}${isBase ? ' <span style="font-size:10px;opacity:.6">(base)</span>' : ''}${fileCount > 0 ? ` <span style="font-size:10px;opacity:.5">(${fileCount} files)</span>` : ''}</span>
              <span class="locale-count">${count}</span>
            </div>
          `;
        }).join('')}
      </div>
      <div class="sidebar__footer">
        <button class="btn btn-secondary w-full" id="settings-btn" style="justify-content:center;gap:8px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Settings
        </button>
      </div>
    `;

    el.querySelector('#open-files-btn').addEventListener('click', openFiles);
    el.querySelector('#create-locale-btn')?.addEventListener('click', showCreateLocaleModal);
    el.querySelector('#base-locale-select')?.addEventListener('change', (e) => {
      store.set('baseLocale', e.target.value);
    });
    el.querySelector('#settings-btn').addEventListener('click', () => onNavigate('settings'));

    el.querySelectorAll('.sidebar__item').forEach(item => {
      item.addEventListener('click', () => {
        const name = item.dataset.locale;
        store.set('activeLocale', name);
        store.set('selectedKey', null);
        store.set('isDetailOpen', false);
        onNavigate('editor');
      });
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const name = item.dataset.locale;
        // Set as base locale on right-click
        store.set('baseLocale', name);
        Toast.info(`"${name}" set as base locale`);
      });
    });
  }

  function showCreateLocaleModal() {
    const locales = store.get('locales') || [];
    const baseLocale = store.get('baseLocale');
    const base = locales.find(l => l.name === baseLocale) || locales[0];
    if (!base) return;

    const body = document.createElement('div');
    body.innerHTML = `
      <div class="form-group">
        <label for="new-locale-input">Language code</label>
        <input type="text" id="new-locale-input" class="form-input"
          placeholder="e.g. DE, FR, ZH-CN" style="text-transform:uppercase" />
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px">
          The new locale will be created with all ${Object.keys(base.data).length} keys from <strong>${base.name}</strong> (empty values).
          ${base.sourceFiles ? `<br/>Source files will be created for each feature: ${base.sourceFiles.map(sf => sf.feature).join(', ')}` : ''}
        </div>
      </div>
    `;

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.gap = '8px';
    footer.innerHTML = `
      <button class="btn btn-secondary" id="cancel-create">Cancel</button>
      <button class="btn btn-primary" id="confirm-create">Create Locale</button>
    `;

    const { close } = Modal({ title: 'Create New Locale', body, footer });

    footer.querySelector('#cancel-create').addEventListener('click', close);
    footer.querySelector('#confirm-create').addEventListener('click', () => {
      const code = body.querySelector('#new-locale-input').value.trim().toUpperCase();
      if (!code) {
        Toast.warning('Please enter a language code');
        return;
      }
      if (locales.find(l => l.name === code)) {
        Toast.warning(`Locale "${code}" already exists`);
        return;
      }

      createLocale(code, base);
      close();
    });

    // Enter to confirm
    body.querySelector('#new-locale-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') footer.querySelector('#confirm-create').click();
    });

    setTimeout(() => body.querySelector('#new-locale-input').focus(), 100);
  }

  function createLocale(code, base) {
    // Build empty data with all keys from the base
    const emptyData = {};
    for (const key of Object.keys(base.data)) {
      emptyData[key] = '';
    }

    const newLocale = {
      name: code,
      path: null,
      data: emptyData,
      meta: { format: base.meta?.format || 'json' },
    };

    // For merged locales, create matching sourceFiles entries
    if (base.sourceFiles && base.sourceFiles.length > 0) {
      newLocale.meta = { format: 'merged' };
      newLocale.sourceFiles = base.sourceFiles.map(sf => {
        // Derive new file path: replace the old language suffix with the new code
        let newPath = null;
        if (sf.path) {
          const dir = sf.path.replace(/[/\\][^/\\]+$/, '');
          const ext = sf.path.match(/\.[^.]+$/)?.[0] || '.ts';
          newPath = `${dir}/${sf.feature}${code}${ext}`;
        }
        return {
          feature: sf.feature,
          path: newPath,
          meta: { ...sf.meta },
          keys: [...sf.keys],
        };
      });
    }

    const locales = store.get('locales') || [];
    store.set('locales', [...locales, newLocale]);
    store.set('activeLocale', code);
    onNavigate('editor');
    Toast.success(`Created locale "${code}" with ${Object.keys(emptyData).length} keys`);
  }

  async function openFiles() {
    try {
      const files = await fileService.openFiles();
      if (!files.length) return;
      const existing = store.get('locales') || [];
      const merged = fileService.mergeLocales(existing, files);
      store.set('locales', merged);
      if (!store.get('baseLocale') && merged.length > 0) {
        store.set('baseLocale', merged[0].name);
      }
      if (!store.get('activeLocale') && merged.length > 0) {
        store.set('activeLocale', merged.length > 1 ? merged[1].name : merged[0].name);
      }
      onNavigate('editor');
      const fileCount = files.reduce((acc, f) => acc + (f.sourceFiles ? f.sourceFiles.length : 1), 0);
      Toast.success(`Loaded ${fileCount} file(s)`);
    } catch (err) {
      Toast.error(`Failed to open files: ${err.message}`);
    }
  }

  store.subscribe('locales', render);
  store.subscribe('activeLocale', render);
  store.subscribe('baseLocale', render);
  render();

  return { el, openFiles };
}

