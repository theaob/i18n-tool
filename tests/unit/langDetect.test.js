const { detectLang, groupByLanguage } = require('../../src/services/langDetect.js');

describe('detectLang', () => {
  test('detects 2-char language suffix', () => {
    expect(detectLang('AuthEN')).toEqual({ feature: 'Auth', lang: 'EN' });
  });

  test('detects TR suffix', () => {
    expect(detectLang('AuthTR')).toEqual({ feature: 'Auth', lang: 'TR' });
  });

  test('detects long feature names', () => {
    expect(detectLang('ApplicationEN')).toEqual({ feature: 'Application', lang: 'EN' });
  });

  test('detects 5-char language codes like ZH-CN', () => {
    expect(detectLang('NavZH-CN')).toEqual({ feature: 'Nav', lang: 'ZH-CN' });
  });

  test('detects PT-BR', () => {
    expect(detectLang('SettingsPT-BR')).toEqual({ feature: 'Settings', lang: 'PT-BR' });
  });

  test('returns null when basename is just a language code (no feature)', () => {
    expect(detectLang('EN')).toBeNull();
  });

  test('returns null for names that do not end with a known code', () => {
    expect(detectLang('myfile')).toBeNull();
  });

  test('returns null for regular locale names like "en"', () => {
    expect(detectLang('en')).toBeNull();
  });

  test('is case-insensitive for detection but preserves original feature casing', () => {
    const result = detectLang('authEn');
    expect(result).toEqual({ feature: 'auth', lang: 'EN' });
  });
});

describe('groupByLanguage', () => {
  test('groups feature files by language', () => {
    const files = [
      { name: 'AuthEN', path: '/auth-en.ts', data: { 'login': 'Login' }, meta: { format: 'ts' } },
      { name: 'AuthTR', path: '/auth-tr.ts', data: { 'login': 'Giriş' }, meta: { format: 'ts' } },
      { name: 'NavEN', path: '/nav-en.ts', data: { 'home': 'Home' }, meta: { format: 'ts' } },
    ];
    const result = groupByLanguage(files);

    // Should produce 2 locales: EN and TR
    expect(result.length).toBe(2);

    const en = result.find(r => r.name === 'EN');
    const tr = result.find(r => r.name === 'TR');

    expect(en).toBeDefined();
    expect(en.data).toEqual({ 'Auth.login': 'Login', 'Nav.home': 'Home' });
    expect(en.sourceFiles.length).toBe(2);

    expect(tr).toBeDefined();
    expect(tr.data).toEqual({ 'Auth.login': 'Giriş' });
    expect(tr.sourceFiles.length).toBe(1);
  });

  test('passes through files without language suffix as-is', () => {
    const files = [
      { name: 'en', path: '/en.json', data: { 'hello': 'Hello' }, meta: { format: 'json' } },
    ];
    const result = groupByLanguage(files);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('en');
    expect(result[0].sourceFiles).toBeUndefined();
  });

  test('handles mix of feature files and regular files', () => {
    const files = [
      { name: 'AuthEN', path: '/auth-en.ts', data: { 'login': 'Login' }, meta: { format: 'ts' } },
      { name: 'en', path: '/en.json', data: { 'hello': 'Hello' }, meta: { format: 'json' } },
    ];
    const result = groupByLanguage(files);
    expect(result.length).toBe(2);
    expect(result.find(r => r.name === 'EN')).toBeDefined();
    expect(result.find(r => r.name === 'en')).toBeDefined();
  });
});
