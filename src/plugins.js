// Plugin registry
const _plugins = new Map();

export const plugins = {
  register(id, plugin) {
    _plugins.set(id, { id, ...plugin });
  },

  get(id) {
    return _plugins.get(id);
  },

  getAll() {
    return Array.from(_plugins.values());
  },

  async runHook(hookName, ...args) {
    const results = [];
    for (const plugin of _plugins.values()) {
      if (typeof plugin[hookName] === 'function') {
        results.push(await plugin[hookName](...args));
      }
    }
    return results;
  },
};

// ── Built-in plugins ──────────────────────────────────────────────────────────

plugins.register('json-formatter', {
  name: 'JSON Formatter',
  description: 'Core JSON import and export support',
  icon: '📄',
  builtin: true,
  enabled: true,

  onImport(text) {
    return JSON.parse(text);
  },

  onExport(data) {
    return JSON.stringify(data, null, 2);
  },
});

plugins.register('gemini-provider', {
  name: 'Gemini AI Translator',
  description: 'AI-powered translation using Google Gemini',
  icon: '✨',
  builtin: true,
  enabled: true,

  async onTranslate({ text, sourceLang, targetLang }) {
    // Delegates to aiService which calls the Electron IPC
    const { aiService } = await import('./services/aiService.js');
    return aiService.translate(text, sourceLang, targetLang);
  },
});
