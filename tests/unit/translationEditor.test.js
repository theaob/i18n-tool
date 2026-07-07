// mock store and services
const mockStore = {
  _state: {},
  get(key) { return this._state[key]; },
  set(key, val) { this._state[key] = val; },
  subscribe: jest.fn(),
};

jest.mock('../../src/store.js', () => ({ store: mockStore }));
jest.mock('../../src/services/translationService.js', () => ({
  translationService: {
    getFilteredKeys: () => ['app.title'],
    getStats: () => ({ total: 1, ok: 0, missing: 1, untranslated: 0 }),
    getKeyStatus: () => 'missing',
    updateTranslation: jest.fn(),
  }
}));
jest.mock('../../src/services/aiService.js', () => ({
  aiService: {
    translate: jest.fn().mockResolvedValue('Translated Title'),
  }
}));

// Setup minimal DOM mocks
const createMockElement = () => ({
  className: '',
  innerHTML: '',
  dataset: {},
  addEventListener: jest.fn(),
  querySelectorAll: jest.fn().mockReturnValue([]),
  querySelector: jest.fn().mockImplementation(() => createMockElement()),
  appendChild: jest.fn(),
});

global.document = {
  createElement: jest.fn().mockImplementation(() => createMockElement()),
  createDocumentFragment: jest.fn().mockReturnValue({
    appendChild: jest.fn(),
  }),
};

global.requestAnimationFrame = jest.fn(fn => fn());

const { TranslationEditor } = require('../../src/components/TranslationEditor.js');

describe('TranslationEditor', () => {
  beforeEach(() => {
    mockStore._state = {
      locales: [
        { name: 'en', data: { 'app.title': 'Hello' } },
        { name: 'es', data: {} }
      ],
      baseLocale: 'en',
    };
  });

  test('can be instantiated and returns element', () => {
    const el = TranslationEditor();
    expect(el).toBeDefined();
    expect(global.document.createElement).toHaveBeenCalledWith('div');
  });
});
