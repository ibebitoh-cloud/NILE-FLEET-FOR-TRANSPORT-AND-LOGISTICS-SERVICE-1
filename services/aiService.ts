
// All Gemini AI calls go through a server-side Netlify Function
// (netlify/functions/ai-proxy.js), so the API key never ships to the browser.

const AI_ENDPOINT = '/.netlify/functions/ai-proxy';

async function callAi(action: string, payload: any) {
  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });
  if (!res.ok) throw new Error(`AI request failed: ${res.status}`);
  return res.json();
}

// Kept for compatibility with any screen that checks "is AI available" before
// showing a feature. Since the key now lives server-side, we can't check it
// directly from the browser — assume available and let the proxy report errors.
export const getSafeApiKey = (): string | null => 'server-managed';

/**
 * Specifically translates logistics entity names from English to Arabic.
 */
export const translateBusinessEntities = async (names: string[]) => {
  if (names.length === 0) return {};
  try {
    return await callAi('translateBusinessEntities', { names });
  } catch (e) {
    console.error('Translation Node Error', e);
    return {};
  }
};

export const runThinkingAudit = async (prompt: string, budget: number = 4000, model: string = 'gemini-3-flash-preview') => {
  const { text } = await callAi('runThinkingAudit', { prompt, model, thinkingBudget: budget });
  return text;
};

export const scanImageForContainer = async (base64Data: string) => {
  try {
    const { text } = await callAi('scanImageForContainer', { base64Data });
    return text || 'NOT_FOUND';
  } catch (e) {
    return 'ERROR';
  }
};

export const mapSpreadsheetToSchema = async (csvData: string): Promise<any[]> => {
  try {
    return await callAi('mapSpreadsheetToSchema', { csvData });
  } catch (e) {
    return [];
  }
};
