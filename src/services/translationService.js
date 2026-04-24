import { store } from '../store.js';

export const translationService = {
  /**
   * Returns all unique keys across all loaded locales.
   */
  getAllKeys() {
    const locales = store.get('locales');
    const keySet = new Set();
    locales.forEach(l => Object.keys(l.data).forEach(k => keySet.add(k)));
    return Array.from(keySet).sort();
  },

  /**
   * Keys present in base locale but absent (or empty) in target locale.
   */
  getMissingKeys(baseLocaleName, targetLocaleName) {
    const locales = store.get('locales');
    const base = locales.find(l => l.name === baseLocaleName);
    const target = locales.find(l => l.name === targetLocaleName);
    if (!base || !target) return [];
    return Object.keys(base.data).filter(
      k => !Object.prototype.hasOwnProperty.call(target.data, k) || target.data[k] === ''
    );
  },

  /**
   * Keys where target value is identical to base value (likely not translated).
   */
  getUntranslatedKeys(baseLocaleName, targetLocaleName) {
    const locales = store.get('locales');
    const base = locales.find(l => l.name === baseLocaleName);
    const target = locales.find(l => l.name === targetLocaleName);
    if (!base || !target) return [];
    return Object.keys(base.data).filter(
      k => target.data[k] && target.data[k] === base.data[k]
    );
  },

  /**
   * Gets the status of a key for a given locale relative to the base.
   */
  getKeyStatus(key, baseLocaleName, targetLocaleName) {
    const locales = store.get('locales');
    const base = locales.find(l => l.name === baseLocaleName);
    const target = locales.find(l => l.name === targetLocaleName);
    if (!target) return 'missing';
    const targetVal = target.data[key];
    if (!targetVal) return 'missing';
    if (base && targetVal === base.data[key]) return 'untranslated';
    return 'ok';
  },

  /**
   * Updates a single translation value in the store.
   */
  updateTranslation(localeName, key, value) {
    const locales = store.get('locales').map(l => {
      if (l.name !== localeName) return l;
      return { ...l, data: { ...l.data, [key]: value } };
    });
    store.set('locales', locales);
  },

  /**
   * Adds a new key to ALL locales (empty string in each).
   */
  addKey(key) {
    const locales = store.get('locales').map(l => ({
      ...l,
      data: { ...l.data, [key]: '' },
    }));
    store.set('locales', locales);
  },

  /**
   * Deletes a key from ALL locales.
   */
  deleteKey(key) {
    const locales = store.get('locales').map(l => {
      const data = { ...l.data };
      delete data[key];
      return { ...l, data };
    });
    store.set('locales', locales);
    if (store.get('selectedKey') === key) {
      store.set('selectedKey', null);
      store.set('isDetailOpen', false);
    }
  },

  /**
   * Returns filtered keys based on search query and filter mode.
   */
  getFilteredKeys() {
    const locales = store.get('locales');
    const base = store.get('baseLocale');
    const active = store.get('activeLocale');
    const query = (store.get('searchQuery') || '').toLowerCase();
    const mode = store.get('filterMode');

    let keys = this.getAllKeys();

    if (query) {
      keys = keys.filter(k => {
        if (k.toLowerCase().includes(query)) return true;
        for (const l of locales) {
          if ((l.data[k] || '').toLowerCase().includes(query)) return true;
        }
        return false;
      });
    }

    if (mode === 'missing' && base && active && base !== active) {
      const missing = new Set(this.getMissingKeys(base, active));
      keys = keys.filter(k => missing.has(k));
    } else if (mode === 'untranslated' && base && active && base !== active) {
      const untranslated = new Set(this.getUntranslatedKeys(base, active));
      keys = keys.filter(k => untranslated.has(k));
    }

    return keys;
  },

  /**
   * Stats for the status bar.
   */
  getStats() {
    const base = store.get('baseLocale');
    const active = store.get('activeLocale');
    const allKeys = this.getAllKeys();
    const total = allKeys.length;

    if (!base || !active || base === active) {
      return { total, missing: 0, untranslated: 0, ok: total };
    }
    const missing = this.getMissingKeys(base, active).length;
    const untranslated = this.getUntranslatedKeys(base, active).length;
    return { total, missing, untranslated, ok: total - missing - untranslated };
  },
};
