import { store } from '../store.js';
import { fileService } from './fileService.js';

export const exportService = {
  /**
   * Saves a locale's data back to its original file path.
   * For merged locales (with sourceFiles), saves each source file separately.
   */
  async exportJson(localeName) {
    const locales = store.get('locales');
    const locale = locales.find(l => l.name === localeName);
    if (!locale) return;

    // Merged locale — save each source file
    if (locale.sourceFiles && locale.sourceFiles.length > 0) {
      return fileService.saveMergedLocale(locale);
    }

    // Regular locale — save to single file
    return fileService.saveFile(locale.path, locale.data, locale.meta);
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

    // Excel picks the CSV field separator from the OS's regional "list
    // separator" setting, not from the file itself. Turkish (and most
    // European) Windows locales use a comma as the decimal separator, so
    // Excel expects ";" for CSV — a comma-separated file opens as one
    // giant column instead of splitting into cells.
    const DELIM = ';';
    const quote = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['key', ...locales.map(l => l.name)].map(quote);
    const rows = keys.map(key => [
      quote(key),
      ...locales.map(l => quote(l.data[key] || ''))
    ]);

    // UTF-8 BOM so Excel on Windows doesn't mis-detect the encoding and
    // mangle non-ASCII characters (Turkish, Azerbaijani, ...).
    const BOM = '﻿';
    const csv = BOM + [headers.join(DELIM), ...rows.map(r => r.join(DELIM))].join('\n');
    return window.electronAPI.saveCsv({ content: csv });
  },
};
