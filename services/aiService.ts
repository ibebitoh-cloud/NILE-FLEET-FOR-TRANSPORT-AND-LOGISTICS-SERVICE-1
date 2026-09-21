// NILE AI Core client. All model execution remains on Cloudflare Workers AI.
const AI_ENDPOINT = '/ai-proxy';

async function callAi(action: string, payload: any) {
  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* handled below */ }
  if (!res.ok) throw new Error(data?.error || `AI request failed: ${res.status}`);
  return data;
}

export const getSafeApiKey = (): string | null => 'server-managed';

export const translateBusinessEntities = async (names: string[]) => {
  if (!names.length) return {};
  try { return await callAi('translateBusinessEntities', { names }); }
  catch (e) { console.error('Translation error', e); return {}; }
};

export const runThinkingAudit = async (prompt: string) => {
  const { text } = await callAi('runThinkingAudit', { prompt });
  return text || '';
};

export const scanImageForContainer = async (base64Data: string) => {
  try {
    const { text } = await callAi('scanImageForContainer', { base64Data });
    return text || 'NOT_FOUND';
  } catch (e) {
    console.error('Container scan error', e);
    return 'ERROR';
  }
};

export const mapSpreadsheetToSchema = async (csvData: string): Promise<any[]> => {
  try { return await callAi('mapSpreadsheetToSchema', { csvData }); }
  catch (e) { console.error('Spreadsheet mapping error', e); return []; }
};
