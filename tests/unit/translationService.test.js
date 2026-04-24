// translationService tests (isolated from Electron)
// We manually implement the store mock to avoid ESM issues in Jest

const storeMock = {
  _state: {},
  get(key) { return this._state[key]; },
  set(key, val) { this._state[key] = val; },
  subscribe() {},
};

jest.mock('../../src/store.js', () => ({ store: storeMock }));

const { translationService } = require('../../src/services/translationService.js');

const LOCALES = [
  { name: 'en', path: null, data: { 'app.title': 'My App', 'app.logout': 'Logout', 'nav.home': 'Home' } },
  { name: 'tr', path: null, data: { 'app.title': 'My App', 'nav.home': 'Ana Sayfa' } },
];

beforeEach(() => {
  storeMock._state = {
    locales: JSON.parse(JSON.stringify(LOCALES)),
    baseLocale: 'en',
    activeLocale: 'tr',
    searchQuery: '',
    filterMode: 'all',
    selectedKey: null,
    isDetailOpen: false,
  };
});

describe('getAllKeys', () => {
  test('returns all unique keys sorted', () => {
    expect(translationService.getAllKeys()).toEqual(['app.logout', 'app.title', 'nav.home']);
  });
});

describe('getMissingKeys', () => {
  test('detects keys in base but absent in target', () => {
    expect(translationService.getMissingKeys('en', 'tr')).toContain('app.logout');
  });

  test('does not include present keys', () => {
    expect(translationService.getMissingKeys('en', 'tr')).not.toContain('nav.home');
  });
});

describe('getUntranslatedKeys', () => {
  test('detects keys with same value as base', () => {
    expect(translationService.getUntranslatedKeys('en', 'tr')).toContain('app.title');
  });

  test('does not include properly translated keys', () => {
    expect(translationService.getUntranslatedKeys('en', 'tr')).not.toContain('nav.home');
  });
});

describe('updateTranslation', () => {
  test('updates value in the correct locale', () => {
    translationService.updateTranslation('tr', 'app.logout', 'Çıkış');
    const locales = storeMock.get('locales');
    expect(locales.find(l => l.name === 'tr').data['app.logout']).toBe('Çıkış');
  });
});

describe('addKey', () => {
  test('adds key to all locales as empty string', () => {
    translationService.addKey('new.key');
    const locales = storeMock.get('locales');
    locales.forEach(l => expect(l.data['new.key']).toBe(''));
  });
});

describe('deleteKey', () => {
  test('removes key from all locales', () => {
    translationService.deleteKey('nav.home');
    const locales = storeMock.get('locales');
    locales.forEach(l => expect(l.data['nav.home']).toBeUndefined());
  });
});
