import { store } from '../store.js';
import { fileService } from '../services/fileService.js';
import { Toast } from './Toast.js';

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
        <button class="btn-icon" id="open-files-btn" title="Open JSON files (⌘O)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>
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
