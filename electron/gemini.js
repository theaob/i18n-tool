const { GoogleGenerativeAI } = require('@google/generative-ai');
const CODE_NAMESPACES = require('../config/codeNamespaces.json');

/**
 * Standardized codes and designators must never be localized.
 * Second line of defence — the renderer applies the same guard.
 * Gated by namespace, not just shape: an all-caps 2-8 char token also
 * matches plenty of legitimate EN words (RADAR, WEAPON, SETTINGS...)
 * that must still be translated outside these known designator namespaces.
 */
const CODE_RE = /^[A-Z0-9][A-Z0-9\-\/]{1,7}$/;
function isCode(text, key = '') {
  const t = String(text ?? '').trim();
  if (!t) return false;
  return CODE_NAMESPACES.some(ns => key.includes(ns)) && CODE_RE.test(t);
}

/**
 * Shared rule block for both prompts — kept feature-neutral on purpose.
 * Anything specific to one feature (e.g. ACM's "Fix"/"State" terminology)
 * belongs in config/featureHints.json instead: a rule tuned for one file
 * and sent on every request would just as happily steer the model wrong
 * on unrelated files (e.g. "quick fix" in a Settings error message).
 */
const DOMAIN_RULES = `Rules:
- Keep placeholders ({name}, {{count}}, %s, %d) and HTML tags exactly as-is
- DO NOT translate standardized codes, designators or abbreviations. An
  all-caps token of 2-8 characters with no spaces that functions as a
  fixed identifier (not a real word) must be returned UNCHANGED
- Keep parenthetical codes/identifiers unchanged, e.g. "... (ID)" stays "... (ID)"
- Preserve the tone: concise, professional, UI-appropriate`;

/**
 * Renders feature-specific hint lines (see config/featureHints.json) that
 * the caller already resolved from the real translation keys. Resolved on
 * the renderer side rather than here, same as the code guard being applied
 * before the API even receives the batch — the raw keys never need to be
 * sent to the model, only the (feature-neutral) hint text they matched.
 * @param {string[]} [hints]
 * @returns {string} extra rule lines, or '' if none apply
 */
function renderHints(hints) {
  return hints && hints.length ? '\n' + hints.map(h => `- ${h}`).join('\n') : '';
}

/**
 * Translates a single UI string using Google Gemini.
 * @param {object} opts
 * @param {string} opts.text - The source string to translate
 * @param {string} opts.sourceLang - Source locale name e.g. "EN"
 * @param {string} opts.targetLang - Target locale name e.g. "TR"
 * @param {string} opts.apiKey - Gemini API key
 * @param {string} [opts.model] - The Gemini model to use
 * @param {string} [opts.key] - Translation key, passed as context only
 * @param {string[]} [opts.hints] - Feature-specific rule lines resolved by the caller
 * @returns {Promise<string>} - Translated string
 */
async function translateWithGemini({
                                     text,
                                     sourceLang,
                                     targetLang,
                                     apiKey,
                                     model = 'gemini-2.0-flash',
                                     key = '',
                                     hints = [],
                                   }) {
  if (!apiKey) throw new Error('Gemini API key is not configured. Go to Settings to add it.');

  const src = String(text ?? '').trim();
  if (!src) return '';
  if (isCode(src, key)) return src;

  const genAI = new GoogleGenerativeAI(apiKey);
  const genModel = genAI.getGenerativeModel({ model });

  const keyLine = key ? `\n- Translation key for context only, do not translate: ${key}` : '';

  const prompt = `You are a localization expert for a military command-and-control (C2) system's user interface. Translate the following UI string from ${sourceLang} to ${targetLang}.

${DOMAIN_RULES}${renderHints(hints)}
- Return ONLY the translated string, with no quotes and no explanation${keyLine}

Source string: ${src}`;

  const result = await genModel.generateContent(prompt);
  const response = await result.response;
  return response.text().trim();
}

/**
 * Batch-translates multiple strings in one Gemini call.
 *
 * `entries` is expected to be keyed by short opaque ids (the renderer
 * sends numeric indices). Ids are echoed back by the model and resolved
 * to real translation keys on the caller's side, so a reworded key in
 * the response cannot desynchronize the mapping.
 *
 * @param {object} opts
 * @param {Record<string,string>} opts.entries - { id: sourceText }
 * @param {string} opts.sourceLang
 * @param {string} opts.targetLang
 * @param {string} opts.apiKey
 * @param {string} [opts.model]
 * @param {string[]} [opts.hints] - Feature-specific rule lines resolved by the caller
 * @returns {Promise<Record<string,string>>} - { id: translatedText }
 */
async function batchTranslateWithGemini({
                                          entries,
                                          sourceLang,
                                          targetLang,
                                          apiKey,
                                          model = 'gemini-2.0-flash',
                                          hints = [],
                                        }) {
  if (!apiKey) throw new Error('Gemini API key is not configured.');

  const ids = Object.keys(entries || {});
  if (ids.length === 0) return {};

  const genAI = new GoogleGenerativeAI(apiKey);
  const genModel = genAI.getGenerativeModel({ model });

  const lines = ids.map(id => `${id}. ${entries[id]}`).join('\n');

  const prompt = `You are a localization expert for a military command-and-control (C2) system's user interface. Translate the following UI strings from ${sourceLang} to ${targetLang}.

${DOMAIN_RULES}${renderHints(hints)}
- Return ONLY a JSON object mapping each input number to its translation,
  e.g. {"1": "...", "2": "..."}
- Include every input number exactly once
- No markdown fences, no explanation

Input:
${lines}`;

  const result = await genModel.generateContent(prompt);
  const response = await result.response;
  const raw = response.text().trim();

  // Strip ```json ... ``` wrappers the model sometimes adds anyway.
  const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Fallback: numbered-line format, e.g. `1. translation`
    parsed = {};
    for (const line of cleaned.split('\n')) {
      const m = line.match(/^\s*"?(\d+)"?\s*[.:)\]]\s*(.+?)\s*$/);
      if (m) parsed[m[1]] = m[2].replace(/^"|"$/g, '');
    }
  }

  // Only return ids we actually asked for, so a hallucinated entry
  // cannot leak into the locale data.
  const output = {};
  for (const id of ids) {
    const val = parsed?.[id];
    if (typeof val === 'string' && val.trim()) output[id] = val.trim();
  }
  return output;
}

module.exports = { translateWithGemini, batchTranslateWithGemini };