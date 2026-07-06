const { parseTs } = require('../../electron/tsParser.js');

describe('parseTs', () => {
  test('parses export default object literal', () => {
    const content = `
      import { Helper } from './utils';
      export default {
        auth: {
          login: "Login"
        }
      };
    `;
    const result = parseTs(content);
    expect(result.data).toEqual({ auth: { login: 'Login' } });
    expect(result.meta.exportType).toBe('default');
    expect(result.meta.imports).toContain("import { Helper } from './utils';");
  });

  test('parses export const named object literal with type annotations', () => {
    const content = `
      export const en: Record<string, any> = {
        title: "Hello World"
      };
    `;
    const result = parseTs(content);
    expect(result.data).toEqual({ title: 'Hello World' });
    expect(result.meta.exportType).toBe('named');
    expect(result.meta.exportName).toBe('en');
  });

  test('parses default export with as const and trailing comma', () => {
    const content = `
      export default {
        title: "Test Title",
      } as const;
    `;
    const result = parseTs(content);
    expect(result.data).toEqual({ title: 'Test Title' });
    expect(result.meta.exportType).toBe('default');
    expect(result.meta.asConst).toBe(true);
  });

  test('parses commonjs module.exports', () => {
    const content = `
      module.exports = {
        title: "CJS"
      };
    `;
    const result = parseTs(content);
    expect(result.data).toEqual({ title: 'CJS' });
    expect(result.meta.exportType).toBe('cjs');
  });

  test('parses export equals syntax', () => {
    const content = `
      export = {
        title: "Export Equals"
      };
    `;
    const result = parseTs(content);
    expect(result.data).toEqual({ title: 'Export Equals' });
    expect(result.meta.exportType).toBe('export-equals');
  });

  test('throws on invalid syntax', () => {
    const content = `
      export default {
        title: "Oops
      }
    `;
    expect(() => parseTs(content)).toThrow();
  });

  test('parses nested objects with type annotations on named export', () => {
    const content = `
      export const translations: Record<string, Record<string, string>> = {
        auth: {
          login: "Sign In",
          logout: "Sign Out"
        },
        nav: {
          home: "Home"
        }
      };
    `;
    const result = parseTs(content);
    expect(result.data).toEqual({
      auth: { login: 'Sign In', logout: 'Sign Out' },
      nav: { home: 'Home' }
    });
    expect(result.meta.exportType).toBe('named');
    expect(result.meta.exportName).toBe('translations');
    expect(result.meta.asConst).toBe(false);
  });
});
