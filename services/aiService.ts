/**
 * aiService.ts
 * Fully local AI — no server call, no API key, no paid service of any kind.
 *
 * - Container code scanning: local OCR (Tesseract.js) + deterministic ISO
 *   6346 checksum validation. See containerOcr.ts.
 * - Everything else (translation, audit reports, spreadsheet mapping): a
 *   small open-source LLM running in-browser via Transformers.js. See
 *   localLLM.ts for the model itself, and aiTools.ts for the deterministic
 *   database lookups that ground its answers in real numbers — the model
 *   is never the source of truth for operational or financial data.
 */

import { scanContainerImage } from './containerOcr';
import { generateLocally, isModelLoaded, type ModelLoadProgress } from './localLLM';
import { selectRelevantTools, buildDataPack } from './aiTools';

export type { ModelLoadProgress };

/** Whether the local model has already been loaded this session. */
export const getSafeApiKey = (): string | null => (isModelLoaded() ? 'local-model-ready' : null);

function parseJsonLoose(text: string): any {
  let cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const firstBrace = Math.min(
    ...[cleaned.indexOf('{'), cleaned.indexOf('[')].filter(i => i !== -1)
  );
  const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (isFinite(firstBrace) && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}

/**
 * Translates logistics entity names (trucking companies, shippers, clients)
 * to Arabic using the local model.
 */
export const translateBusinessEntities = async (
  names: string[],
  onProgress?: (p: ModelLoadProgress) => void
): Promise<Record<string, string>> => {
  if (names.length === 0) return {};
  try {
    const text = await generateLocally(
      [
        { role: 'system', content: 'You translate logistics business entity names (trucking companies, shippers, clients) into professional Arabic. Respond with ONLY a raw JSON object — no markdown, no commentary — where each key is the original name and each value is its Arabic translation.' },
        { role: 'user', content: `Names: ${names.join(', ')}` },
      ],
      { maxNewTokens: 500, onProgress }
    );
    return parseJsonLoose(text);
  } catch (e) {
    console.error('Local translation error', e);
    return {};
  }
};

/**
 * Runs a grounded strategic/financial audit. The prompt passed in is
 * combined with a deterministic data pack pulled straight from the real
 * database (see aiTools.ts) — the model is explicitly instructed to use
 * only those numbers and never invent figures of its own.
 */
export const runThinkingAudit = async (
  prompt: string,
  _budget?: number,
  _model?: string,
  onProgress?: (p: ModelLoadProgress) => void
): Promise<string> => {
  const tools = selectRelevantTools(prompt);
  const dataPack = buildDataPack(tools);

  const groundedPrompt = `DATA (the only facts you may reference — do not invent, estimate, or state any number not shown here):
${JSON.stringify(dataPack, null, 2)}

QUESTION / TASK:
${prompt}

Answer using ONLY the numbers in DATA above. If the data needed to answer isn't present, say so explicitly rather than guessing.`;

  const text = await generateLocally(
    [
      { role: 'system', content: 'You are a sharp, concise financial and operations auditor for a logistics/genset-rental business. You must never state a number that is not explicitly present in the DATA block you are given — if you are unsure, say the data is not available rather than estimating.' },
      { role: 'user', content: groundedPrompt },
    ],
    { maxNewTokens: 700, onProgress }
  );
  return text;
};

/**
 * Extracts a container BIC code from an image using fully local OCR — no
 * model, no server call. Returns just the code (or NOT_FOUND/ERROR) so
 * callers can use it directly; use scanImageForContainerDetailed if you
 * also need to know whether the checksum validated.
 */
export const scanImageForContainer = async (base64Data: string): Promise<string> => {
  try {
    const result = await scanContainerImage(base64Data);
    return result.code || 'NOT_FOUND';
  } catch (e) {
    console.error('Local OCR error', e);
    return 'ERROR';
  }
};

/** Same as scanImageForContainer, but also reports whether the ISO 6346 checksum validated. */
export const scanImageForContainerDetailed = async (base64Data: string) => {
  try {
    return await scanContainerImage(base64Data);
  } catch (e) {
    console.error('Local OCR error', e);
    return { code: null, valid: false, rawText: '', confidence: 0 };
  }
};

/**
 * Maps a pasted spreadsheet/CSV block into the app's operation schema using
 * the local model, with Arabic translations for entity fields.
 */
export const mapSpreadsheetToSchema = async (
  csvData: string,
  onProgress?: (p: ModelLoadProgress) => void
): Promise<any[]> => {
  try {
    const text = await generateLocally(
      [
        {
          role: 'system',
          content: `You are a logistics data mapper. Convert the given CSV/text data into a JSON array. Identify columns even if their names differ slightly from expected. For every entity field (customerName, beneficiaryName, trucker), also provide its Arabic translation in a field suffixed with 'Ar'.

Each array item must have exactly these fields: customerName, customerNameAr, bookingNumber, containerNumber, gensetNumber, clipOnPort, clipOffPort, rate, operationDate, trucker, truckerAr, beneficiaryName, beneficiaryNameAr.

Respond with ONLY the raw JSON array — no markdown, no commentary.`,
        },
        { role: 'user', content: csvData },
      ],
      { maxNewTokens: 2000, onProgress }
    );
    return parseJsonLoose(text);
  } catch (e) {
    console.error('Local spreadsheet mapping error', e);
    return [];
  }
};
