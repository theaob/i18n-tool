import { store } from './store.js';
import { fileService } from './services/fileService.js';
import { Sidebar } from './components/Sidebar.js';
import { Toolbar } from './components/Toolbar.js';
import { TranslationEditor } from './components/TranslationEditor.js';
import { KeyDetail } from './components/KeyDetail.js';
import { SettingsPanel, applyTheme } from './components/SettingsPanel.js';
import { Toast } from './components/Toast.js';
import './plugins.js'; // register built-ins

// ── Theme init ────────────────────────────────────────────────────────────────
async function initTheme() {
  const savedTheme = await window.electronAPI.getSetting('geminiApiKey');
  const theme = (await window.electronAPI.getSetting('theme')) || 'system';
  store.set('theme', theme);
  applyTheme(theme);

  const apiKey = await window.electronAPI.getSetting('geminiApiKey') || '';
  store.set('geminiApiKey', apiKey);
}

// ── View state ────────────────────────────────────────────────────────────────
// view: 'home' | 'editor' | 'settings'
let currentView = 'home';

function navigate(view) {
  currentView = view;
  renderApp();
}

// ── App render ────────────────────────────────────────────────────────────────
function renderApp() {
  const root = document.getElementById('root');
  root.innerHTML = '';

  if (currentView === 'settings') {
    const layout = document.createElement('div');
    layout.className = 'app-layout';
    layout.style.gridTemplateColumns = '1fr';
    layout.style.gridTemplateRows = 'var(--titlebar-h) 1fr';

    const titlebar = makeTitlebar('Settings');
    const settings = SettingsPanel(() => navigate('editor'));

    layout.appendChild(titlebar);
    layout.appendChild(settings);
    root.appendChild(layout);
    return;
  }

  const locales = store.get('locales') || [];

  if (currentView === 'home' && locales.length === 0) {
    renderHome(root);
    return;
  }

  // Editor layout
  const isDetailOpen = store.get('isDetailOpen') && store.get('selectedKey');
  const layout = document.createElement('div');
  layout.className = `app-layout ${isDetailOpen ? 'detail-open' : ''}`;

  const titlebar = makeTitlebar();
  const { el: sidebar } = Sidebar(navigate);
  const toolbar = Toolbar();
  const editor = TranslationEditor();

  layout.appendChild(titlebar);
  layout.appendChild(sidebar);
  layout.appendChild(toolbar);
  layout.appendChild(editor);

  if (isDetailOpen) {
    const detail = KeyDetail();
    layout.appendChild(detail);
  }

  root.appendChild(layout);
}

function renderHome(root) {
  const layout = document.createElement('div');
  layout.className = 'app-layout';
  layout.style.gridTemplateColumns = '1fr';
  layout.style.gridTemplateRows = 'var(--titlebar-h) 1fr';

  layout.appendChild(makeTitlebar());

  const main = document.createElement('div');
  main.style.display = 'flex';
  main.style.overflow = 'hidden';

  const { el: sidebar, openFiles } = Sidebar(navigate);
  const home = document.createElement('div');
  home.className = 'home-view';
  home.innerHTML = `
    <div class="home-view__icon">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M5 8l4-4 4 4M9 4v10M3 16l3 3 3-3M6 13v6M15 8h6M15 12h4M15 16h6"/>
      </svg>
    </div>
    <h1>i18n Tool</h1>
    <p>Manage your JSON translation files with AI-powered assistance. Open your locale files to get started.</p>
    <div class="home-view__actions">
      <div class="home-card" id="home-open">
        <div class="home-card__icon">📂</div>
        <div class="home-card__title">Open Files</div>
        <div class="home-card__desc">Open one or more JSON locale files from disk</div>
      </div>
      <div class="home-card" id="home-drop">
        <div class="home-card__icon">🎯</div>
        <div class="home-card__title">Drag & Drop</div>
        <div class="home-card__desc">Drop your JSON files anywhere on the window</div>
      </div>
      <div class="home-card" id="home-settings">
        <div class="home-card__icon">⚙️</div>
        <div class="home-card__title">Settings</div>
        <div class="home-card__desc">Configure Gemini API key and preferences</div>
      </div>
    </div>
    <p style="font-size:12px;color:var(--text-muted)">
      Tip: Right-click a locale in the sidebar to set it as the <strong>base</strong> locale
    </p>
  `;

  home.querySelector('#home-open').addEventListener('click', openFiles);
  home.querySelector('#home-settings').addEventListener('click', () => navigate('settings'));
  home.querySelector('#home-drop').addEventListener('click', () => {
    Toast.info('Just drag & drop JSON files anywhere on this window!');
  });

  main.appendChild(sidebar);
  main.appendChild(home);
  layout.appendChild(main);
  root.appendChild(layout);
}

function makeTitlebar(subtitle) {
  const bar = document.createElement('div');
  bar.className = 'titlebar';
  bar.innerHTML = `<span class="titlebar__title">i18n Tool${subtitle ? ` — ${subtitle}` : ''}</span>`;
  return bar;
}

// ── Drag & drop ───────────────────────────────────────────────────────────────
function initDragDrop() {
  const overlay = document.getElementById('drag-overlay');

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    overlay.classList.remove('hidden');
  });

  document.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null) overlay.classList.add('hidden');
  });

  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    overlay.classList.add('hidden');
    const jsonFiles = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.json'));
    if (!jsonFiles.length) { Toast.warning('Only JSON files are supported'); return; }

    try {
      const files = await fileService.readDroppedFiles(jsonFiles);
      const existing = store.get('locales') || [];
      const existingNames = new Set(existing.map(l => l.name));
      const newOnes = files.filter(f => !existingNames.has(f.name));
      const merged = [...existing, ...newOnes];
      store.set('locales', merged);
      if (!store.get('baseLocale') && merged.length > 0) store.set('baseLocale', merged[0].name);
      if (!store.get('activeLocale') && merged.length > 0) {
        store.set('activeLocale', merged.length > 1 ? merged[1].name : merged[0].name);
      }
      navigate('editor');
      Toast.success(`Loaded ${files.length} file(s)`);
    } catch (err) {
      Toast.error(`Failed to load files: ${err.message}`);
    }
  });
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
function initKeyboardShortcuts() {
  document.addEventListener('keydown', async (e) => {
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key === 'k') {
      e.preventDefault();
      document.getElementById('search-input')?.focus();
    }
    if (meta && e.key === 'o') {
      e.preventDefault();
      const { Sidebar } = await import('./components/Sidebar.js');
      // trigger open via store event is simplest:
      const files = await fileService.openFiles();
      if (files.length) {
        const existing = store.get('locales') || [];
        const existingNames = new Set(existing.map(l => l.name));
        const merged = [...existing, ...files.filter(f => !existingNames.has(f.name))];
        store.set('locales', merged);
        navigate('editor');
        Toast.success(`Loaded ${files.length} file(s)`);
      }
    }
    if (meta && e.key === 'n') {
      e.preventDefault();
      document.getElementById('add-key-btn')?.click();
    }
    if (meta && e.key === 'e') {
      e.preventDefault();
      document.getElementById('export-btn')?.click();
    }
    if (e.key === 'Escape') {
      if (store.get('isDetailOpen')) {
        store.set('isDetailOpen', false);
        store.set('selectedKey', null);
      }
    }
  });
}

// ── Store subscriptions → re-render ──────────────────────────────────────────
store.subscribe('isDetailOpen', renderApp);
store.subscribe('locales', () => {
  const locales = store.get('locales') || [];
  if (locales.length > 0 && currentView === 'home') navigate('editor');
  else renderApp();
});

// ── Boot ─────────────────────────────────────────────────────────────────────
(async () => {
  await initTheme();
  initDragDrop();
  initKeyboardShortcuts();
  renderApp();
})();
