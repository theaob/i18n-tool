const mockStore = {
  _state: { geminiApiKey: 'test-key', geminiModel: 'gemini-2.0-flash' },
  get(key) { return this._state[key]; },
  set(key, val) { this._state[key] = val; },
};

jest.mock('../../src/store.js', () => ({ store: mockStore }));

const { aiService, isCode } = require('../../src/services/aiService.js');

beforeEach(() => {
  aiService.clearCache();
  global.window = { electronAPI: {} };
});

describe('isCode', () => {
  test('protects known designator namespaces', () => {
    expect(isCode('DZ', 'ACMTranslation.acmUsage.DROP_ZONE')).toBe(true);
    expect(isCode('CORRTE', 'ACMTranslation.acmTypeShort.AIR_CORRIDOR')).toBe(true);
  });

  test('does not protect the same shape outside a known namespace', () => {
    expect(isCode('RADAR', 'ApplicationTranslation.windowTitles.radarPropertyWindow')).toBe(false);
    expect(isCode('WEAPON', 'ApplicationTranslation.windowTitles.weaponSystemPropertyWindow')).toBe(false);
  });
});

describe('aiService.batchTranslate', () => {
  test('never calls the API for code-namespace values', async () => {
    window.electronAPI.batchTranslate = jest.fn();
    window.electronAPI.translate = jest.fn();

    const entries = { 'ACMTranslation.acmUsage.DROP_ZONE': 'DZ' };
    const result = await aiService.batchTranslate(entries, 'EN', 'TR');

    expect(result).toEqual({ 'ACMTranslation.acmUsage.DROP_ZONE': 'DZ' });
    expect(window.electronAPI.batchTranslate).not.toHaveBeenCalled();
    expect(window.electronAPI.translate).not.toHaveBeenCalled();
  });

  test('sends the same source text to the API only once, applies it to every key that shares it', async () => {
    window.electronAPI.batchTranslate = jest.fn().mockResolvedValue({ '1': 'Kontrol Otoritesi' });

    const entries = {
      'featureA.controlAuthority': 'Control Authority',
      'featureB.controlAuthority': 'Control Authority',
      'featureC.controlAuthority': 'Control Authority',
    };
    const result = await aiService.batchTranslate(entries, 'EN', 'TR');

    expect(window.electronAPI.batchTranslate).toHaveBeenCalledTimes(1);
    const payload = window.electronAPI.batchTranslate.mock.calls[0][0].entries;
    expect(Object.keys(payload)).toHaveLength(1); // deduped to one unique source string
    expect(result['featureA.controlAuthority']).toBe('Kontrol Otoritesi');
    expect(result['featureB.controlAuthority']).toBe('Kontrol Otoritesi');
    expect(result['featureC.controlAuthority']).toBe('Kontrol Otoritesi');
  });

  test('reuses the session cache instead of re-calling the API for a text seen in an earlier batch', async () => {
    window.electronAPI.batchTranslate = jest.fn().mockResolvedValue({ '1': 'Durum' });

    await aiService.batchTranslate({ k1: 'State' }, 'EN', 'TR');
    expect(window.electronAPI.batchTranslate).toHaveBeenCalledTimes(1);

    const result = await aiService.batchTranslate({ k2: 'State' }, 'EN', 'TR');
    expect(window.electronAPI.batchTranslate).toHaveBeenCalledTimes(1); // not called again
    expect(result.k2).toBe('Durum');
  });

  test('falls back to per-string translate() when the model drops an id from the batch response', async () => {
    window.electronAPI.batchTranslate = jest.fn().mockResolvedValue({}); // model returned nothing
    window.electronAPI.translate = jest.fn().mockResolvedValue('Yedek Çeviri');

    const result = await aiService.batchTranslate({ k1: 'Fallback Text' }, 'EN', 'TR');

    expect(window.electronAPI.translate).toHaveBeenCalledTimes(1);
    expect(result.k1).toBe('Yedek Çeviri');
  });

  test('onChunk streams the instant (code/cache) results before the API resolves, then each network chunk', async () => {
    let resolveApi;
    window.electronAPI.batchTranslate = jest.fn(() => new Promise(r => { resolveApi = r; }));

    const entries = {
      code1: 'DZ_PLACEHOLDER'.slice(0, 2), // 'DZ' — not actually a code without the right key, forcing API path below instead
    };
    // Use a real code entry plus one that needs the API, mixed in one call.
    const mixedEntries = {
      'ACMTranslation.acmUsage.DROP_ZONE': 'DZ', // instant: code guard
      needsApi: 'Needs Translation',
    };

    const chunks = [];
    const promise = aiService.batchTranslate(mixedEntries, 'EN', 'TR', {
      onChunk: (partial) => chunks.push(partial),
    });

    // Instant chunk (the code) should have already fired synchronously,
    // before the API promise for the real network chunk resolves.
    await Promise.resolve(); // let the microtask queue flush up to the await point
    expect(chunks[0]).toEqual({ 'ACMTranslation.acmUsage.DROP_ZONE': 'DZ' });

    resolveApi({ '1': 'Çeviri Gerekli' });
    const result = await promise;

    expect(chunks[1]).toEqual({ needsApi: 'Çeviri Gerekli' });
    expect(result.needsApi).toBe('Çeviri Gerekli');
  });

  test('splits into multiple chunks when there are more unique texts than chunkSize', async () => {
    window.electronAPI.batchTranslate = jest.fn()
        .mockResolvedValueOnce({ '1': 'Bir', '2': 'İki' })
        .mockResolvedValueOnce({ '1': 'Üç' });

    const entries = { k1: 'One', k2: 'Two', k3: 'Three' };
    const result = await aiService.batchTranslate(entries, 'EN', 'TR', { chunkSize: 2 });

    expect(window.electronAPI.batchTranslate).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ k1: 'Bir', k2: 'İki', k3: 'Üç' });
  });
});
