// Reactive state store — observer pattern
const _state = {
  locales: [],          // [{ name, path, data: { key: value }, meta, sourceFiles?: [{ feature, path, meta, keys }] }]
  baseLocale: null,     // string locale name
  activeLocale: null,   // string locale name
  selectedKey: null,    // string key
  searchQuery: '',
  filterMode: 'all',    // 'all' | 'missing' | 'untranslated'
  theme: 'system',      // 'light' | 'dark' | 'system'
  geminiApiKey: '',
  plugins: [],
  isDetailOpen: false,
  isSaving: false,
};

const _listeners = {};

export const store = {
  get(key) {
    return _state[key];
  },

  set(key, value) {
    _state[key] = value;
    (_listeners[key] || []).forEach(fn => fn(value, key));
    (_listeners['*'] || []).forEach(fn => fn(value, key));
  },

  subscribe(key, fn) {
    if (!_listeners[key]) _listeners[key] = [];
    _listeners[key].push(fn);
    return () => {
      _listeners[key] = _listeners[key].filter(f => f !== fn);
    };
  },

  getAll() {
    return { ..._state };
  },
};
