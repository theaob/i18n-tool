import { store } from '../store.js';
import CODE_NAMESPACES from '../../config/codeNamespaces.json';
import FEATURE_HINTS from '../../config/featureHints.json';

/**
 * Standardized codes and designators (ADatP-3 / APP-6) must never be
 * localized. An all-caps token of 2-8 chars with no spaces is treated
 * as a code and returned unchanged.
 */
const CODE_RE = /^[A-Z0-9][A-Z0-9\-\/]{1,7}$/;

export function isCode(text, key = '') {
  const t = (text || '').trim();
  if (!t) return false;
  // Gated on namespace, not just shape: plenty of legitimate short EN words
  // (RADAR, WEAPON, SETTINGS, AIRBASE...) also match the all-caps pattern
  // and must still be translated outside these known designator namespaces.
  return CODE_NAMESPACES.some(ns => key.includes(ns)) && CODE_RE.test(t);
}

/**
 * Resolves which feature-specific prompt hints (config/featureHints.json)
 * apply to a set of translation keys. A rule tuned for one feature (e.g.
 * ACM's "Fix means navigation fix") must not be sent on every request —
 * that would just as happily steer the model wrong on unrelated features.
 * @param {string[]} keys
 * @returns {string[]} deduped hint lines, or [] if nothing matched
 */
function hintsForKeys(keys) {
  const lines = new Set();
  for (const [ns, hints] of Object.entries(FEATURE_HINTS)) {
    if (keys.some(k => k.includes(ns))) hints.forEach(h => lines.add(h));
  }
  return Array.from(lines);
}

/**
 * Session-scoped translation memory.
 * Guarantees that the same source string always yields the same
 * translation within a session, and avoids duplicate API calls.
 */
const memo = new Map();
const memoKey = (text, src, tgt) => `${src}\u0000${tgt}\u0000${text}`;

function getCreds() {
  const apiKey = store.get('geminiApiKey');
  const model = store.get('geminiModel') || 'gemini-2.0-flash';
  return { apiKey, model };
}

export const aiService = {
  cacheSize: () => memo.size,
  clearCache: () => memo.clear(),

  /**
   * Translates a single string via Gemini (through Electron IPC).
   * Codes are short-circuited and cached results are reused.
   *
   * @param {string} text        Source string
   * @param {string} sourceLang  Base locale name, e.g. "EN"
   * @param {string} targetLang  Target locale name, e.g. "TR"
   * @param {string} [key]       Translation key, sent to Gemini as context only
   * @returns {Promise<string>}
   */
  async translate(text, sourceLang, targetLang, key = '') {
    const src = (text || '').trim();
    if (!src) return '';
    if (isCode(src, key)) return src;

    const mk = memoKey(src, sourceLang, targetLang);
    if (memo.has(mk)) return memo.get(mk);

    const { apiKey, model } = getCreds();
    if (!apiKey) throw new Error('Gemini API key not configured. Go to Settings.');

    const out = await window.electronAPI.translate({
      text: src,
      sourceLang,
      targetLang,
      apiKey,
      model,
      key,
      hints: hintsForKeys([key]),
    });

    const clean = (out || '').trim();
    if (clean) memo.set(mk, clean);
    return clean;
  },

  /**
   * Translates many strings with as few API calls as possible.
   *
   * Pipeline: code guard -> cache -> dedupe by source text -> chunked
   * batch call -> per-string fallback for anything the model dropped.
   *
   * The API receives numeric indices rather than translation keys, so a
   * malformed or reworded key in the response cannot desynchronize the
   * mapping; indices are resolved back to keys locally.
   *
   * @param {Record<string,string>} entries  { key: sourceText }
   * @param {string} sourceLang
   * @param {string} targetLang
   * @param {{ chunkSize?: number, onProgress?: (done:number, total:number) => void, onChunk?: (partial: Record<string,string>) => void }} [opts]
   *   `onChunk` fires with just the newly-resolved key/value pairs as each
   *   chunk (and the instant code/cache hits) lands, so the caller can
   *   apply translations to the UI incrementally instead of waiting for
   *   the whole batch to finish.
   * @returns {Promise<Record<string,string>>} { key: translation }
   */
  async batchTranslate(entries, sourceLang, targetLang, opts = {}) {
    const { chunkSize = 50, onProgress, onChunk } = opts;

    const result = {};
    const instant = {}; // codes + cache hits, resolved synchronously
    const needed = new Map(); // sourceText -> [key, ...]
    const total = Object.keys(entries).length;

    for (const [key, raw] of Object.entries(entries)) {
      const src = (raw || '').trim();
      if (!src) { result[key] = ''; instant[key] = ''; continue; }
      if (isCode(src, key)) { result[key] = src; instant[key] = src; continue; }

      const mk = memoKey(src, sourceLang, targetLang);
      if (memo.has(mk)) { result[key] = memo.get(mk); instant[key] = memo.get(mk); continue; }

      if (!needed.has(src)) needed.set(src, []);
      needed.get(src).push(key);
    }

    onProgress?.(Object.keys(result).length, total);
    if (Object.keys(instant).length > 0) onChunk?.(instant);

    const texts = Array.from(needed.keys());
    if (texts.length === 0) return result;

    const { apiKey, model } = getCreds();
    if (!apiKey) throw new Error('Gemini API key not configured. Go to Settings.');

    for (let i = 0; i < texts.length; i += chunkSize) {
      const chunk = texts.slice(i, i + chunkSize);

      const payload = {};
      chunk.forEach((t, idx) => { payload[String(idx + 1)] = t; });
      const chunkKeys = chunk.flatMap(t => needed.get(t));

      let translated = {};
      try {
        translated = await window.electronAPI.batchTranslate({
          entries: payload,
          sourceLang,
          targetLang,
          apiKey,
          model,
          hints: hintsForKeys(chunkKeys),
        }) || {};
      } catch {
        translated = {}; // whole chunk falls through to per-string retry
      }

      const chunkResult = {};
      for (let idx = 0; idx < chunk.length; idx++) {
        const src = chunk[idx];
        let out = translated[String(idx + 1)];

        if (typeof out !== 'string' || !out.trim()) {
          try {
            out = await window.electronAPI.translate({
              text: src,
              sourceLang,
              targetLang,
              apiKey,
              model,
              key: needed.get(src)[0],
              hints: hintsForKeys(needed.get(src)),
            });
          } catch {
            out = '';
          }
        }

        const clean = (out || '').trim();
        if (!clean) continue;

        memo.set(memoKey(src, sourceLang, targetLang), clean);
        for (const key of needed.get(src)) { result[key] = clean; chunkResult[key] = clean; }
      }

      onProgress?.(Object.keys(result).length, total);
      if (Object.keys(chunkResult).length > 0) onChunk?.(chunkResult);
    }

    return result;
  },
};