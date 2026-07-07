const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Translates a UI string using Google Gemini.
 * @param {object} opts
 * @param {string} opts.text - The source string to translate
 * @param {string} opts.sourceLang - BCP-47 language code e.g. "en"
 * @param {string} opts.targetLang - BCP-47 language code e.g. "tr"
 * @param {string} opts.apiKey - Gemini API key
 * @param {string} [opts.model] - The Gemini model to use
 * @returns {Promise<string>} - Translated string
 */
async function translateWithGemini({ text, sourceLang, targetLang, apiKey, model = 'gemini-3.1-flash' }) {
  if (!apiKey) throw new Error('Gemini API key is not configured. Go to Settings to add it.');

  const genAI = new GoogleGenerativeAI(apiKey);
  const genModel = genAI.getGenerativeModel({ model });

  const prompt = `You are a professional software localization expert. Translate the following UI string from ${sourceLang} to ${targetLang}.

Rules:
- Keep placeholders like {name}, {{count}}, %s, %d exactly as-is
- Keep HTML tags exactly as-is
- Return ONLY the translated string, nothing else
- Do not add quotes around the result
- Preserve the tone: concise, professional, UI-appropriate

Source string: ${text}`;

  const result = await genModel.generateContent(prompt);
  const response = await result.response;
  return response.text().trim();
}

/**
 * Batch-translates multiple strings in one Gemini call.
 * @param {object} opts
 * @param {Record<string,string>} opts.entries - { key: sourceText }
 * @param {string} opts.sourceLang
 * @param {string} opts.targetLang
 * @param {string} opts.apiKey
 * @param {string} [opts.model]
 * @returns {Promise<Record<string,string>>} - { key: translatedText }
 */
async function batchTranslateWithGemini({ entries, sourceLang, targetLang, apiKey, model = 'gemini-3.1-flash' }) {
  if (!apiKey) throw new Error('Gemini API key is not configured.');

  const genAI = new GoogleGenerativeAI(apiKey);
  const genModel = genAI.getGenerativeModel({ model });

  const keys = Object.keys(entries);
  const lines = keys.map((k, i) => `${i + 1}. [${k}]: ${entries[k]}`).join('\n');

  const prompt = `You are a professional software localization expert. Translate the following UI strings from ${sourceLang} to ${targetLang}.

Rules:
- Keep placeholders like {name}, {{count}}, %s, %d exactly as-is
- Keep HTML tags exactly as-is
- Return ONLY numbered translations matching the input order, in the format: N. [key]: translation
- Do not add any explanation

Strings to translate:
${lines}`;

  const result = await genModel.generateContent(prompt);
  const response = await result.response;
  const responseText = response.text().trim();

  // Parse response lines back into { key: translation }
  const output = {};
  const lineRegex = /^\d+\.\s*\[(.+?)\]:\s*(.+)$/;
  for (const line of responseText.split('\n')) {
    const match = line.match(lineRegex);
    if (match) {
      output[match[1]] = match[2].trim();
    }
  }
  return output;
}

module.exports = { translateWithGemini, batchTranslateWithGemini };
