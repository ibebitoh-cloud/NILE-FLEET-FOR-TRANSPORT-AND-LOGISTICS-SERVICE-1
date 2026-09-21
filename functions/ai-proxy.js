// Cloudflare Pages Function: runs all AI features on Cloudflare Workers AI —
// free, open-source models (Llama 3.3 for text, Llama 3.2 Vision for images).
// No external API key, no billing account: the model runs directly on
// Cloudflare's infrastructure via the "AI" binding (Settings -> Functions ->
// Bindings -> add "AI" -> variable name AI). Free tier: 10,000 Neurons/day,
// resets daily, no credit card required.

const TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

// Open models are less reliable than Claude/GPT at strictly following
// "return only JSON" instructions — strip code fences and grab the first
// {...} or [...] block to make parsing robust.
function parseJsonLoose(text) {
  let cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const firstBrace = Math.min(
    ...[cleaned.indexOf('{'), cleaned.indexOf('[')].filter(i => i !== -1)
  );
  const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (firstBrace !== Infinity && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.AI) {
    return json({ error: 'Workers AI binding not configured. Add an "AI" binding in Cloudflare -> Settings -> Functions -> Bindings.' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { action, payload } = body;

  try {
    switch (action) {
      case 'translateBusinessEntities': {
        const { names } = payload;
        if (!names || names.length === 0) return json({});
        const result = await env.AI.run(TEXT_MODEL, {
          messages: [
            { role: 'system', content: 'You translate logistics business entity names (trucking companies, shippers, clients) into professional Arabic. Respond with ONLY a raw JSON object — no markdown, no code fences, no commentary — where each key is the original name and each value is its Arabic translation.' },
            { role: 'user', content: `Names: ${names.join(', ')}` },
          ],
          max_tokens: 1500,
        });
        return json(parseJsonLoose(result.response || ''));
      }

      case 'runThinkingAudit': {
        const { prompt } = payload;
        const result = await env.AI.run(TEXT_MODEL, {
          messages: [
            { role: 'system', content: 'You are a sharp, concise financial and operations auditor for a logistics/genset-rental business. Give direct, practical, numbers-grounded analysis.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 3000,
        });
        return json({ text: result.response || '' });
      }

      case 'scanImageForContainer': {
        const { base64Data } = payload;
        const dataUri = base64Data.startsWith('data:') ? base64Data : `data:image/jpeg;base64,${base64Data}`;
        const result = await env.AI.run(VISION_MODEL, {
          messages: [
            { role: 'system', content: "Extract the shipping container BIC code (4 letters followed by 7 digits, e.g. MEDU9907021) from the image. Respond with ONLY the code itself, nothing else. If no valid code is visible, respond with exactly: NOT_FOUND" },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Extract the container code.' },
                { type: 'image_url', image_url: { url: dataUri } },
              ],
            },
          ],
          max_tokens: 50,
        });
        return json({ text: (result.response || '').trim() || 'NOT_FOUND' });
      }

      case 'mapSpreadsheetToSchema': {
        const { csvData } = payload;
        const result = await env.AI.run(TEXT_MODEL, {
          messages: [
            { role: 'system', content: `You are a logistics data mapper. Convert the given CSV/text data into a JSON array. Identify columns even if their names differ slightly from expected. For every entity field (customerName, beneficiaryName, trucker), also provide its Arabic translation in a field suffixed with 'Ar'.

Each array item must have exactly these fields: customerName, customerNameAr, bookingNumber, containerNumber, gensetNumber, clipOnPort, clipOffPort, rate, operationDate, trucker, truckerAr, beneficiaryName, beneficiaryNameAr.

Respond with ONLY the raw JSON array — no markdown, no code fences, no commentary.` },
            { role: 'user', content: csvData },
          ],
          max_tokens: 4000,
        });
        return json(parseJsonLoose(result.response || ''));
      }

      default:
        return json({ error: 'Unknown action' }, 400);
    }
  } catch (err) {
    return json({ error: 'AI request failed: ' + (err?.message || String(err)) }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
