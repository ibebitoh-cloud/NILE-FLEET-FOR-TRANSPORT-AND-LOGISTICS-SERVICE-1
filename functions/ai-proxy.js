// Cloudflare Pages Function: runs all AI features on Cloudflare Workers AI —
// free, open-source models (Llama 3.3 for text, Llama 3.2 Vision for images).
// No external API key, no billing account: the model runs directly on
// Cloudflare's infrastructure via the "AI" binding (Settings -> Functions ->
// Bindings -> add "AI" -> variable name AI). Free tier: 10,000 Neurons/day,
// resets daily, no credit card required.

const TEXT_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';
const VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
const TEXT_FALLBACK_MODEL = '@cf/zai-org/glm-4.7-flash';

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
        const result = await runTextModel(env, {
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
        const result = await runTextModel(env, {
          messages: [
            { role: 'system', content: 'You are a sharp financial and operations auditor for a logistics/genset-rental business. Give direct, practical, numbers-grounded analysis. If the user prompt requests Arabic, you MUST respond entirely in professional Arabic: translate all headings, labels, statuses, port names, entity descriptions and explanatory text. Never output English UI labels. Preserve booking numbers, container numbers, genset numbers, dates and numeric values exactly. Do not invent data.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: Math.min(Math.max(payload?.maxTokens || 1600, 200), 3000),
        });
        return json({ text: result.response || '' });
      }

      case 'scanImageForContainer': {
        const { base64Data } = payload;
        const dataUri = base64Data.startsWith('data:') ? base64Data : `data:image/jpeg;base64,${base64Data}`;
        const result = await env.AI.run(VISION_MODEL, {
          messages: [
            { role: 'system', content: "Read the shipping container number visible in the image. A valid BIC container number is exactly 4 letters followed by 7 digits, for example MEDU9907021. Return ONLY the 11-character code in uppercase. Ignore truck numbers, booking numbers, logos and other text. If the container number is not clearly readable, return NOT_FOUND." },
            { role: 'user', content: 'Extract the container number from this image.' },
          ],
          image: dataUri,
          max_tokens: 32,
          temperature: 0,
        });
        return json({ text: (result.response || '').trim() || 'NOT_FOUND' });
      }

      case 'mapSpreadsheetToSchema': {
        const { csvData } = payload;
        const result = await runTextModel(env, {
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
    console.error('NILE AI proxy error', err);
    return json({
      error: 'AI request failed',
      detail: err?.message || String(err),
      model: TEXT_MODEL,
      fallbackModel: TEXT_FALLBACK_MODEL,
    }, 500);
  }
}

async function runTextModel(env, options) {
  try {
    return await env.AI.run(TEXT_MODEL, options);
  } catch (primaryError) {
    console.error('Primary Workers AI model failed, trying fallback', primaryError);
    try {
      return await env.AI.run(TEXT_FALLBACK_MODEL, options);
    } catch (fallbackError) {
      throw new Error(
        `Primary model failed: ${primaryError?.message || primaryError}; fallback model failed: ${fallbackError?.message || fallbackError}`
      );
    }
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
