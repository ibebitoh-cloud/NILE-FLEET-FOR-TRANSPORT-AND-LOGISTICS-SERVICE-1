import { pipeline } from '@huggingface/transformers';

const AI_ENDPOINT = '/ai-proxy';
const LOCAL_MODEL = 'onnx-community/Qwen2.5-0.5B-Instruct';
let localGenerator: any = null;
let localLoading: Promise<any> | null = null;

async function getLocalGenerator() {
  if (localGenerator) return localGenerator;
  if (!localLoading) {
    localLoading = pipeline('text-generation', LOCAL_MODEL, {
      dtype: 'q4',
      device: 'webgpu',
    }).catch(async () => {
      return pipeline('text-generation', LOCAL_MODEL, { dtype: 'q4' });
    });
  }
  localGenerator = await localLoading;
  return localGenerator;
}

async function callAi(action: string, payload: any) {
  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });
  if (!res.ok) throw new Error(`AI request failed: ${res.status}`);
  return res.json();
}

export const getSafeApiKey = (): string | null => 'local-nile-ai';

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
    const generator = await getLocalGenerator();
    const output = await generator([
      {
        role: 'system',
        content: 'You are NILE AI CORE, an operations assistant for a genset logistics company. Answer only from the supplied NILE data. Never invent numbers. Be concise. Support English and Arabic.',
      },
      { role: 'user', content: prompt },
    ], {
      max_new_tokens: Math.min(Math.max(budget, 200), 1600),
      do_sample: false,
    });
    const generated = output?.[0]?.generated_text;
    if (Array.isArray(generated)) return generated[generated.length - 1]?.content || '';
    if (typeof generated === 'string') return generated.replace(prompt, '').trim();
    return '';
  } catch (localError) {
    console.warn('Local NILE AI unavailable; using Cloudflare AI fallback.', localError);
    try {
      const { text } = await callAi('runThinkingAudit', { prompt });
      return text || '';
    } catch (cloudError) {
      console.error('NILE AI fallback failed', cloudError);
      return 'NILE AI is temporarily unavailable. The operational data remains available.';
    }
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
