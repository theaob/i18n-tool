const { flattenJson, unflattenJson } = require('../../src/services/fileService.js');

describe('flattenJson', () => {
  test('flattens nested object', () => {
    expect(flattenJson({ auth: { login: { title: 'Login' } } }))
      .toEqual({ 'auth.login.title': 'Login' });
  });

  test('leaves flat object unchanged', () => {
    expect(flattenJson({ hello: 'world' })).toEqual({ hello: 'world' });
  });

  test('handles mixed depth', () => {
    const result = flattenJson({ a: '1', b: { c: '2', d: { e: '3' } } });
    expect(result).toEqual({ a: '1', 'b.c': '2', 'b.d.e': '3' });
  });

  test('converts null to empty string', () => {
    expect(flattenJson({ a: null })).toEqual({ a: '' });
  });
});

describe('unflattenJson', () => {
  test('unflattens dot-notation keys', () => {
    expect(unflattenJson({ 'auth.login.title': 'Login' }))
      .toEqual({ auth: { login: { title: 'Login' } } });
  });

  test('round-trips flatten → unflatten', () => {
    const original = { auth: { login: 'Login', logout: 'Logout' }, home: { title: 'Home' } };
    expect(unflattenJson(flattenJson(original))).toEqual(original);
  });
});
