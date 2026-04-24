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
   * @returns {Promise<Array<{name, path, data}>>}
   */
  async openFiles() {
    const files = await window.electronAPI.openFiles();
    return files.map(({ name, path, content }) => {
      let parsed = {};
      try { parsed = JSON.parse(content); } catch { /* invalid JSON */ }
      return { name, path, data: flattenJson(parsed) };
    });
  },

  /**
   * Saves a locale back to disk as formatted JSON.
   * @param {string} filePath - Original path (null to open save dialog)
   * @param {object} flatData - Flat key-value translation object
   */
  async saveFile(filePath, flatData) {
    const nested = unflattenJson(flatData);
    const content = JSON.stringify(nested, null, 2);
    return window.electronAPI.saveFile({ filePath, content });
  },

  /**
   * Imports JSON files dropped onto the window.
   * @param {FileList} fileList
   */
  async readDroppedFiles(fileList) {
    const results = [];
    for (const file of fileList) {
      const text = await file.text();
      let parsed = {};
      try { parsed = JSON.parse(text); } catch { /* invalid */ }
      const name = file.name.replace(/\.json$/, '');
      results.push({ name, path: null, data: flattenJson(parsed) });
    }
    return results;
  },
};
