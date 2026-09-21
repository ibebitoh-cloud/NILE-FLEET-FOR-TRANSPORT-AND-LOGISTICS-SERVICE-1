const AI_ENDPOINT = '/ai-proxy';
const OPEN_SOURCE_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

async function callAi(action: string, payload: any) {
  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });
  if (!res.ok) throw new Error(`AI request failed: ${res.status}`);
  return res.json();
}

export const getSafeApiKey = (): string | null => 'open-source-nile-ai';

export const translateBusinessEntities = async (names: string[]) => {
  if (names.length === 0) return {};
  try {
    return await callAi('translateBusinessEntities', { names });
  } catch (e) {
    console.error('Translation Node Error', e);
    return {};
  }
};

export const runThinkingAudit = async (prompt: string, budget: number = 1200) => {
  try {
    const { text } = await callAi('runThinkingAudit', {
      prompt,
      model: OPEN_SOURCE_MODEL,
      maxTokens: Math.min(Math.max(budget, 200), 1600),
    });
    return text || '';
  } catch (e) {
    console.error('NILE AI failed', e);
    return 'NILE AI is temporarily unavailable. The operational data remains available.';
  }
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
