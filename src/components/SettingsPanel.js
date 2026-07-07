import { store } from '../store.js';
import { plugins } from '../plugins.js';
import { Toast } from './Toast.js';

export function SettingsPanel(onBack) {
  const el = document.createElement('div');
  el.className = 'settings-view';

  async function render() {
    const currentTheme = store.get('theme') || 'system';
    const apiKey = store.get('geminiApiKey') || '';
    const currentModel = store.get('geminiModel') || 'gemini-2.0-flash';
    const allPlugins = plugins.getAll();

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:28px">
        <button class="btn btn-ghost btn-sm" id="back-btn" style="padding:6px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h2 style="margin:0;font-size:20px;font-weight:700">Settings</h2>
      </div>

      <div class="settings-section">
        <h3>AI Translation</h3>
        <div class="form-group">
          <label for="gemini-key">Gemini API Key</label>
          <input type="password" id="gemini-key" class="form-input" 
            placeholder="AIza…" value="${apiKey}" autocomplete="off" />
          <span class="hint">
            Get a free key at 
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com</a>.
            Stored securely on disk, never sent to any third party.
          </span>
        </div>
        <div class="form-group" style="margin-top:16px">
          <label for="gemini-model">Model</label>
          <select id="gemini-model" class="form-input">
            <option value="gemini-2.0-flash" ${currentModel === 'gemini-2.0-flash' ? 'selected' : ''}>Gemini 2.0 Flash (Fast)</option>
            <option value="gemini-1.5-pro-latest" ${currentModel === 'gemini-1.5-pro-latest' ? 'selected' : ''}>Gemini 1.5 Pro (Advanced)</option>
            <option value="gemini-1.5-flash-latest" ${currentModel === 'gemini-1.5-flash-latest' ? 'selected' : ''}>Gemini 1.5 Flash</option>
            <option value="gemini-pro" ${currentModel === 'gemini-pro' ? 'selected' : ''}>Gemini Pro 1.0 (Legacy)</option>
          </select>
          <button class="btn btn-secondary btn-sm" id="fetch-models-btn" style="margin-top:8px;gap:6px">
            🔄 Refresh Models from Google API
          </button>
        </div>
        <button class="btn btn-primary btn-sm" id="save-api-key" style="margin-top:16px">Save AI Settings</button>
      </div>

      <div class="settings-section">
        <h3>Appearance</h3>
        <div class="form-group">
          <label>Theme</label>
          <div class="theme-selector">
            <button class="theme-option ${currentTheme === 'light' ? 'selected' : ''}" data-theme="light">☀️ Light</button>
            <button class="theme-option ${currentTheme === 'dark' ? 'selected' : ''}" data-theme="dark">🌙 Dark</button>
            <button class="theme-option ${currentTheme === 'system' ? 'selected' : ''}" data-theme="system">💻 System</button>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3>Plugins</h3>
        <div class="plugin-grid">
          ${allPlugins.map(p => `
            <div class="plugin-card">
              <div class="plugin-card__icon">${p.icon || '🔌'}</div>
              <div class="plugin-card__info">
                <div class="plugin-card__name">${p.name}</div>
                <div class="plugin-card__desc">${p.description || ''}${p.builtin ? ' • Built-in' : ''}</div>
              </div>
              <label class="toggle" title="${p.builtin ? 'Built-in (cannot disable)' : 'Toggle plugin'}">
                <input type="checkbox" ${p.enabled ? 'checked' : ''} ${p.builtin ? 'disabled' : ''} data-plugin="${p.id}" />
                <div class="toggle__track"></div>
                <div class="toggle__thumb"></div>
              </label>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="settings-section">
        <h3>Keyboard Shortcuts</h3>
        <div style="display:flex;flex-direction:column;gap:10px;font-size:13px">
          ${[
            ['Open files', '⌘ O'],
            ['Search', '⌘ K'],
            ['Add key', '⌘ N'],
            ['Export JSON', '⌘ E'],
            ['Close detail panel', 'Esc'],
          ].map(([action, shortcut]) => `
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="color:var(--text-secondary)">${action}</span>
              <kbd>${shortcut}</kbd>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Retrieve cached models list if stored
    let selectedModel = currentModel;
    const cachedModels = store.get('geminiAvailableModels') || [];
    const select = el.querySelector('#gemini-model');

    if (cachedModels.length > 0) {
      select.innerHTML = cachedModels.map(m => `
        <option value="${m.name}" ${selectedModel === m.name ? 'selected' : ''}>${m.displayName}</option>
      `).join('');
    }

    // Keep track of the user's active selection
    select.addEventListener('change', (e) => {
      selectedModel = e.target.value;
    });

    el.querySelector('#back-btn').addEventListener('click', onBack);

    // Fetch dynamic models
    el.querySelector('#fetch-models-btn').addEventListener('click', async () => {
      const key = el.querySelector('#gemini-key').value.trim();
      if (!key) {
        Toast.error('Please enter an API key first');
        return;
      }
      const btn = el.querySelector('#fetch-models-btn');
      btn.disabled = true;
      btn.innerHTML = '⏳ Querying Google API...';
      try {
        const fetched = await window.electronAPI.fetchModels(key);
        if (fetched && fetched.length > 0) {
          store.set('geminiAvailableModels', fetched);
          await window.electronAPI.setSetting('geminiAvailableModels', fetched);
          
          // Use the latest selectedModel instead of currentModel to preserve selection
          select.innerHTML = fetched.map(m => `
            <option value="${m.name}" ${selectedModel === m.name ? 'selected' : ''}>${m.displayName}</option>
          `).join('');
          
          // Re-update the selectedModel to the select value in case the previous selection is not in the list
          selectedModel = select.value;

          Toast.success(`Found ${fetched.length} models supporting translation`);
        } else {
          Toast.warning('No compatible models returned by the API');
        }
      } catch (err) {
        Toast.error(`Failed to retrieve models: ${err.message}`);
      } finally {
        btn.disabled = false;
        btn.innerHTML = '🔄 Refresh Models from Google API';
      }
    });

    // AI save
    el.querySelector('#save-api-key').addEventListener('click', async () => {
      const key = el.querySelector('#gemini-key').value.trim();
      store.set('geminiApiKey', key);
      store.set('geminiModel', selectedModel);
      await window.electronAPI.setSetting('geminiApiKey', key);
      await window.electronAPI.setSetting('geminiModel', selectedModel);
      Toast.success('AI settings saved');
    });

    // Theme
    el.querySelectorAll('.theme-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        store.set('theme', theme);
        applyTheme(theme);
        window.electronAPI.setSetting('theme', theme);
        el.querySelectorAll('.theme-option').forEach(b => b.classList.toggle('selected', b === btn));
      });
    });
  }

  store.subscribe('theme', render);
  render();
  return el;
}

export function applyTheme(theme) {
  let effective = theme;
  if (theme === 'system') {
    effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', effective);
}
