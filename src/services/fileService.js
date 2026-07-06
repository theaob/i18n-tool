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

export const fileService = {
  /**
   * Opens the native file dialog and returns parsed locale data.
   * @returns {Promise<Array<{name, path, data, meta}>>}
   */
  async openFiles() {
    const files = await window.electronAPI.openFiles();
    return Promise.all(files.map(async ({ name, path: filePath, content, ext }) => {
      if (ext === '.ts') {
        try {
          const parsed = await window.electronAPI.parseTs(content);
          return { name, path: filePath, data: flattenJson(parsed.data), meta: parsed.meta };
        } catch (err) {
          throw new Error(`Error parsing ${name}.ts: ${err.message}`);
        }
      } else {
        let parsed = {};
        try { parsed = JSON.parse(content); } catch { /* invalid JSON */ }
        return { name, path: filePath, data: flattenJson(parsed), meta: { format: 'json' } };
      }
    }));
  },

  /**
   * Saves a locale back to disk.
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
   * Imports JSON or TS files dropped onto the window.
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
    return results;
  },
};
