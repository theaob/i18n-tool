/**
 * Language detection utility for feature-based translation files.
 *
 * Given a filename like "AuthEN" or "NavZH-CN", detects the language suffix
 * by matching against a list of known BCP-47/ISO language codes.
 *
 * Uses longest-match-first so "ZH-CN" wins over "CN".
 */

// Known language codes sorted by length descending so longest match wins.
const KNOWN_CODES = [
  // 5-char codes
  'ZH-CN', 'ZH-TW', 'PT-BR', 'EN-US', 'EN-GB', 'ES-MX', 'ES-AR', 'FR-CA', 'SR-SP',
  // 2-char codes (ISO 639-1)
  'AF', 'AR', 'AZ', 'BE', 'BG', 'BN', 'BS', 'CA', 'CS', 'CY', 'DA', 'DE',
  'EL', 'EN', 'ES', 'ET', 'EU', 'FA', 'FI', 'FR', 'GA', 'GL', 'GU', 'HE',
  'HI', 'HR', 'HU', 'HY', 'ID', 'IS', 'IT', 'JA', 'KA', 'KK', 'KM', 'KN',
  'KO', 'KY', 'LO', 'LT', 'LV', 'MK', 'ML', 'MN', 'MR', 'MS', 'MY', 'NB',
  'NE', 'NL', 'NN', 'NO', 'PA', 'PL', 'PS', 'PT', 'RO', 'RU', 'SI', 'SK',
  'SL', 'SQ', 'SR', 'SV', 'SW', 'TA', 'TE', 'TH', 'TL', 'TR', 'UK', 'UR',
  'UZ', 'VI', 'ZH',
];

/**
 * Attempts to detect a language suffix from a basename (no extension).
 *
 * @param {string} basename - e.g. "AuthEN", "ApplicationZH-CN", "en"
 * @returns {{ feature: string, lang: string } | null}
 *   Returns feature (e.g. "Auth") and lang (e.g. "EN"), or null if no match.
 */
export function detectLang(basename) {
  const upper = basename.toUpperCase();

  for (const code of KNOWN_CODES) {
    if (upper.endsWith(code) && upper.length > code.length) {
      const feature = basename.slice(0, basename.length - code.length);
      // Ensure the feature part isn't empty and doesn't end with a separator
      // that would indicate a different naming convention
      if (feature.length > 0) {
        return { feature, lang: code };
      }
    }
  }

  return null;
}

/**
 * Groups an array of loaded file objects by detected language.
 *
 * Files that match a feature+lang pattern are grouped into merged locale objects.
 * Files that don't match are returned as-is (regular locale files).
 *
 * @param {Array<{name, path, data, meta}>} files - Loaded file objects from fileService
 * @returns {Array<{name, path, data, meta, sourceFiles?}>} - Grouped locale objects
 */
export function groupByLanguage(files) {
  const langGroups = {};  // lang -> [{ feature, file }]
  const ungrouped = [];

  for (const file of files) {
    const detected = detectLang(file.name);
    if (detected) {
      const { feature, lang } = detected;
      if (!langGroups[lang]) langGroups[lang] = [];
      langGroups[lang].push({ feature, file });
    } else {
      ungrouped.push(file);
    }
  }

  const result = [];

  // Create merged locales for each language group
  for (const [lang, entries] of Object.entries(langGroups)) {
    const mergedData = {};
    const sourceFiles = [];

    for (const { feature, file } of entries) {
      const keys = Object.keys(file.data);
      for (const key of keys) {
        mergedData[`${feature}.${key}`] = file.data[key];
      }
      sourceFiles.push({
        feature,
        path: file.path,
        meta: file.meta,
        keys,
      });
    }

    result.push({
      name: lang,
      path: null, // merged locale — no single path
      data: mergedData,
      meta: { format: 'merged' },
      sourceFiles,
    });
  }

  // Add ungrouped files as-is
  for (const file of ungrouped) {
    result.push(file);
  }

  return result;
}
