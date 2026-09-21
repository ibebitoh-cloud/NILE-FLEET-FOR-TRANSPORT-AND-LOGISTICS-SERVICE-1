// Cloudflare Pages Function: NILE AI Core using Cloudflare Workers AI.
// Operational AI is server-side; no provider API key is exposed to the browser.

const TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
const MAX_BODY_BYTES = 8 * 1024 * 1024;

function parseJsonLoose(text) {
  let cleaned = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const starts = [cleaned.indexOf('{'), cleaned.indexOf('[')].filter(i => i >= 0);
  const first = starts.length ? Math.min(...starts) : -1;
  const last = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (first >= 0 && last > first) cleaned = cleaned.slice(first, last + 1);
  return JSON.parse(cleaned);
}

function normalizeContainer(value) {
  return String(value || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

// ISO 6346 check digit. This prevents the vision model from returning a
// syntactically plausible but operationally invalid container number.
function isValidContainerCode(value) {
  const code = normalizeContainer(value);
  if (!/^[A-Z]{4}[0-9]{7}$/.test(code)) return false;
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const n = chars.indexOf(code[i]);
    if (n < 0) return false;
    sum += n * (2 ** i);
  }
  return (sum % 11) % 10 === Number(code[10]);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.AI) return json({ error: 'Workers AI binding not configured.' }, 500);

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) return json({ error: 'Request too large. Compress the image before scanning.' }, 413);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { action, payload = {} } = body || {};
  try {
    switch (action) {
      case 'translateBusinessEntities': {
        const names = Array.isArray(payload.names) ? payload.names.slice(0, 100) : [];
        if (!names.length) return json({});
        const result = await env.AI.run(TEXT_MODEL, {
          messages: [
            { role: 'system', content: 'Translate logistics business entity names into professional Arabic. Return ONLY a raw JSON object mapping each original name to Arabic.' },
            { role: 'user', content: `Names: ${names.join(', ')}` },
          ], max_tokens: 1500,
        });
        return json(parseJsonLoose(result.response || ''));
      }

      case 'runThinkingAudit': {
        const prompt = typeof payload.prompt === 'string' ? payload.prompt.slice(0, 30000) : '';
        if (!prompt) return json({ error: 'Prompt is required.' }, 400);
        const result = await env.AI.run(TEXT_MODEL, {
          messages: [
            { role: 'system', content: 'You are a concise operations and financial auditor for a genset-rental logistics business. Use only numbers and facts supplied in the prompt. Do not invent database facts.' },
            { role: 'user', content: prompt },
          ], max_tokens: 3000,
        });
        return json({ text: result.response || '' });
      }

      case 'scanImageForContainer': {
        const base64Data = typeof payload.base64Data === 'string' ? payload.base64Data : '';
        if (!base64Data || base64Data.length > MAX_BODY_BYTES) return json({ error: 'Image is missing or too large.' }, 400);
        const dataUri = base64Data.startsWith('data:') ? base64Data : `data:image/jpeg;base64,${base64Data}`;
        const result = await env.AI.run(VISION_MODEL, {
          messages: [
            { role: 'system', content: 'Extract the shipping container BIC code. Return ONLY the 11-character code. If none is visible, return NOT_FOUND.' },
            { role: 'user', content: [
              { type: 'text', text: 'Extract the container code.' },
              { type: 'image_url', image_url: { url: dataUri } },
            ]},
          ], max_tokens: 50,
        });
        const candidate = normalizeContainer(result.response || '');
        return json({ text: isValidContainerCode(candidate) ? candidate : 'NOT_FOUND' });
      }

      case 'mapSpreadsheetToSchema': {
        const csvData = typeof payload.csvData === 'string' ? payload.csvData.slice(0, 100000) : '';
        if (!csvData) return json({ error: 'CSV data is required.' }, 400);
        const result = await env.AI.run(TEXT_MODEL, {
          messages: [
            { role: 'system', content: `Convert CSV/text logistics data into a JSON array. Each item must have exactly: customerName, customerNameAr, bookingNumber, containerNumber, gensetNumber, clipOnPort, clipOffPort, rate, operationDate, trucker, truckerAr, beneficiaryName, beneficiaryNameAr. Return ONLY raw JSON.` },
            { role: 'user', content: csvData },
          ], max_tokens: 4000,
        });
        return json(parseJsonLoose(result.response || ''));
      }
      default: return json({ error: 'Unknown action' }, 400);
    }
  } catch (err) {
    console.error('[NILE AI CORE]', err);
    return json({ error: 'AI request failed.' }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
