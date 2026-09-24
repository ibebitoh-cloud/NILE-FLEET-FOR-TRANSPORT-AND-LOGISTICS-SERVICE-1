// Cloudflare Pages Function: runs all AI features on Cloudflare Workers AI.
// DALI uses Qwen3 for fast text reasoning and Qwen3.8 for multimodal container OCR.

const TEXT_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';
const VISION_MODEL = '@cf/qwen/qwen3.8-27b';
const VISION_FALLBACK_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
const TEXT_FALLBACK_MODEL = '@cf/zai-org/glm-4.7-flash';

// Open models are less reliable than Claude/GPT at strictly following
// "return only JSON" instructions — strip code fences and grab the first
// {...} or [...] block to make parsing robust.
function parseJsonLoose(text) {
  let cleaned = text.replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\`\`\`\s*$/i, '').trim();
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

  // Health check: opening /ai-proxy in a browser now tells us whether the
  // Worker is actually deployed with the Workers AI binding.
  if (request.method === 'GET') {
    return json({
      ok: !!env.AI,
      service: 'DALI 1.0',
      textModel: TEXT_MODEL,
      visionModel: VISION_MODEL,
      message: env.AI ? 'Workers AI binding is connected.' : 'Workers AI binding is missing.'
    }, env.AI ? 200 : 500);
  }

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
        return json(parseJsonLoose(extractText(result)));
      }

      case 'runThinkingAudit': {
        const { prompt } = payload || {};
        if (!prompt?.trim()) return json({ error: 'Empty AI prompt' }, 400);
        const result = await runTextModel(env, {
          messages: [
            { role: 'system', content: 'You are DALI 1.0, the private operations intelligence assistant for NILE FLEET. The system creator/owner is Bebito (bebito@nilefleet.com). If the current-user context identifies Bebito, recognize him as the creator/owner of the system and answer with that context in mind; do not treat him as an ordinary customer or employee. Give direct, practical, numbers-grounded analysis. If the user prompt requests Arabic, respond entirely in professional Arabic. Never output English UI labels when Arabic is requested. Preserve booking numbers, container numbers, genset numbers, dates and numeric values exactly. Do not invent data.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: Math.min(Math.max(payload?.maxTokens || 1600, 200), 3000),
          temperature: 0.2,
        });
        const text = extractText(result);
        if (!text) {
          throw new Error('Workers AI returned no text from the primary/fallback model.');
        }
        return json({ text });
      }

      case 'scanImageForContainer': {
        const { base64Data } = payload || {};
        if (!base64Data) return json({ error: 'No image data supplied' }, 400);
        const dataUri = base64Data.startsWith('data:') ? base64Data : `data:image/jpeg;base64,${base64Data}`;
        const visionInput = {
          messages: [
            { role: 'system', content: "Read the shipping container number visible in the image. A valid BIC container number is exactly 4 letters followed by 7 digits, for example MEDU9907021. Return ONLY the 11-character code in uppercase. Ignore truck numbers, booking numbers, logos and other text. If the container number is not clearly readable, return NOT_FOUND." },
            { role: 'user', content: 'Extract the container number from this image.' },
          ],
          image: dataUri,
          max_tokens: 32,
          temperature: 0,
        };
        let result;
        try {
          result = await env.AI.run(VISION_MODEL, visionInput);
        } catch (primaryError) {
          console.error('Primary container vision model failed:', primaryError);
          result = await env.AI.run(VISION_FALLBACK_MODEL, visionInput);
        }
        const raw = String(result?.response || '').toUpperCase().trim();
        const match = raw.match(/[A-Z]{4}[0-9]{7}/);
        return json({ text: match ? match[0] : 'NOT_FOUND' });
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

function extractText(result) {
  if (typeof result === 'string') return result.trim();
  if (!result || typeof result !== 'object') return '';
  if (typeof result.response === 'string') return result.response.trim();
  if (typeof result.output_text === 'string') return result.output_text.trim();
  if (typeof result.text === 'string') return result.text.trim();
  if (typeof result.reasoning === 'string' && result.reasoning.trim()) return result.reasoning.trim();
  if (Array.isArray(result.choices)) {
    const choice = result.choices[0];
    const content = choice?.message?.content ?? choice?.text;
    if (typeof content === 'string') return content.trim();
  }
  return '';
}

async function runTextModel(env, options) {
  const modelOptions = {
    ...options,
    chat_template_kwargs: {
      ...(options.chat_template_kwargs || {}),
      enable_thinking: false,
    },
  };

  try {
    const result = await env.AI.run(TEXT_MODEL, modelOptions);
    if (extractText(result)) return result;
    console.error('Primary Workers AI model returned an empty text response:', result);
  } catch (primaryError) {
    console.error('Primary Workers AI model failed, trying fallback', primaryError);
  }

  try {
    const result = await env.AI.run(TEXT_FALLBACK_MODEL, modelOptions);
    if (extractText(result)) return result;
    throw new Error('Workers AI fallback returned an empty text response.');
  } catch (fallbackError) {
    throw new Error(
      `Qwen3 returned no usable text; fallback model failed: ${fallbackError?.message || fallbackError}`
    );
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
