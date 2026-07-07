/**
 * Flattens a nested JSON object to dot-notation keys.
 * e.g. { auth: { login: { title: "Login" } } } → { "auth.login.title": "Login" }
 */
export function flattenJson(obj, prefix = '') {
  return Object.entries(obj).reduce((acc, [key, val]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(acc, flattenJson(val, fullKey));
    } else {
      acc[fullKey] = String(val ?? '');
    }
    return acc;
  }, {});
}

/**
 * Unflattens dot-notation keys back to nested object.
 */
export function unflattenJson(flat) {
  const result = {};
  for (const [key, val] of Object.entries(flat)) {
    const parts = key.split('.');
    let cur = result;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        cur[part] = val;
      } else {
        cur[part] = cur[part] || {};
        cur = cur[part];
      }
    });
  }
  return result;
}

import { groupByLanguage } from './langDetect.js';

export const fileService = {
  /**
   * Opens the native file dialog and returns parsed locale data.
   * Files with feature+lang naming (e.g. AuthEN.ts) are automatically
   * grouped into merged locale objects by language.
   * @returns {Promise<Array<{name, path, data, meta, sourceFiles?}>>}
   */
  async openFiles() {
    const files = await window.electronAPI.openFiles();
    const parsed = await Promise.all(files.map(async ({ name, path: filePath, content, ext }) => {
      if (ext === '.ts') {
        const result = await window.electronAPI.parseTs(content);
        return { name, path: filePath, data: flattenJson(result.data), meta: result.meta };
      } else {
        let result = {};
        try { result = JSON.parse(content); } catch { /* invalid JSON */ }
        return { name, path: filePath, data: flattenJson(result), meta: { format: 'json' } };
      }
    }));
    return groupByLanguage(parsed);
  },

  /**
   * Saves a locale back to disk.
   * For regular (non-merged) locales, writes to the single file path.
   * @param {string} filePath - Original path (null to open save dialog)
   * @param {object} flatData - Flat key-value translation object
   * @param {object} meta - Locale format metadata
   */
  async saveFile(filePath, flatData, meta) {
    const nested = unflattenJson(flatData);
    let content;
    let format = 'json';
    
    if (meta && meta.format === 'ts') {
      format = 'ts';
      const jsonContent = JSON.stringify(nested, null, 2);
      
      let exportStr = '';
      if (meta.exportType === 'named') {
        exportStr = `export const ${meta.exportName || 'locale'} = `;
      } else if (meta.exportType === 'cjs') {
        exportStr = 'module.exports = ';
      } else if (meta.exportType === 'export-equals') {
        exportStr = 'export = ';
      } else {
        exportStr = 'export default ';
      }
      
      let prependedImports = '';
      if (meta.imports && meta.imports.length > 0) {
        prependedImports = meta.imports.join('\n') + '\n\n';
      }
      
      content = `${prependedImports}${exportStr}${jsonContent}`;
      if (meta.asConst) {
        content += ` as const`;
      }
      content += `;\n`;
    } else {
      content = JSON.stringify(nested, null, 2);
    }
    
    return window.electronAPI.saveFile({ filePath, content, format });
  },

  /**
   * Saves a merged locale by writing each source file separately.
   * Extracts the feature-prefixed keys belonging to each source file,
   * strips the prefix, unflattens, and saves.
   * @param {object} locale - Merged locale object with sourceFiles
   * @returns {Promise<Array<{success, path}>>}
   */
  async saveMergedLocale(locale) {
    if (!locale.sourceFiles || locale.sourceFiles.length === 0) {
      return [];
    }
    const results = [];
    for (const sf of locale.sourceFiles) {
      const prefix = `${sf.feature}.`;
      const featureData = {};
      for (const [key, val] of Object.entries(locale.data)) {
        if (key.startsWith(prefix)) {
          featureData[key.slice(prefix.length)] = val;
        }
      }
      const result = await this.saveFile(sf.path, featureData, sf.meta);
      results.push(result);
    }
    return results;
  },

  /**
   * Imports JSON or TS files dropped onto the window.
   * Files with feature+lang naming are automatically grouped.
   * @param {FileList} fileList
   */
  async readDroppedFiles(fileList) {
    const results = [];
    for (const file of fileList) {
      const text = await file.text();
      const isTs = file.name.endsWith('.ts');
      let data = {};
      let meta = { format: 'json' };
      
      if (isTs) {
        const parsed = await window.electronAPI.parseTs(text);
        data = parsed.data;
        meta = parsed.meta;
      } else {
        try { data = JSON.parse(text); } catch { /* invalid */ }
      }
      
      const name = file.name.replace(/\.(json|ts)$/, '');
      results.push({ name, path: null, data: flattenJson(data), meta });
    }
    return groupByLanguage(results);
  },

  /**
   * Merges newly loaded locales into existing ones.
   * For merged locales (with sourceFiles), merges source files from new
   * entries into existing locale entries of the same language.
   * For regular locales, deduplicates by name.
   * @param {Array} existing - Current locales from store
   * @param {Array} newFiles - Newly loaded locale objects
   * @returns {Array} - Merged locales array
   */
  mergeLocales(existing, newFiles) {
    const merged = [...existing];

    for (const newLocale of newFiles) {
      const existingIdx = merged.findIndex(l => l.name === newLocale.name);
      if (existingIdx >= 0) {
        const existing = merged[existingIdx];
        // Both are merged locales — merge sourceFiles and data
        if (newLocale.sourceFiles && existing.sourceFiles) {
          const existingFeatures = new Set(existing.sourceFiles.map(sf => sf.feature));
          for (const sf of newLocale.sourceFiles) {
            if (!existingFeatures.has(sf.feature)) {
              existing.sourceFiles.push(sf);
              // Add the prefixed keys
              const prefix = `${sf.feature}.`;
              for (const [key, val] of Object.entries(newLocale.data)) {
                if (key.startsWith(prefix)) {
                  existing.data[key] = val;
                }
              }
            }
          }
        }
        // else: same name, skip duplicate regular file
      } else {
        merged.push(newLocale);
      }
    }

    return merged;
  },
};

