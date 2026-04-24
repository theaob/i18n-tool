import { store } from '../store.js';
import { unflattenJson } from './fileService.js';

export const exportService = {
  /**
   * Saves a locale's data back to its original file path as JSON.
   */
  async exportJson(localeName) {
    const locales = store.get('locales');
    const locale = locales.find(l => l.name === localeName);
    if (!locale) return;
    const nested = unflattenJson(locale.data);
    const content = JSON.stringify(nested, null, 2);
    const result = await window.electronAPI.saveFile({ filePath: locale.path, content });
    return result;
  },

  /**
   * Exports all locales as a single CSV (key, locale1, locale2, ...).
   */
  async exportCsv() {
    const locales = store.get('locales');
    if (!locales.length) return;

    const allKeys = new Set();
    locales.forEach(l => Object.keys(l.data).forEach(k => allKeys.add(k)));
    const keys = Array.from(allKeys).sort();

    const headers = ['key', ...locales.map(l => l.name)];
    const rows = keys.map(key => [
      key,
      ...locales.map(l => `"${(l.data[key] || '').replace(/"/g, '""')}"`)
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    return window.electronAPI.saveCsv({ content: csv });
  },
};
