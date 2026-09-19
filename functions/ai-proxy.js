// Cloudflare Pages Function: proxies all Gemini AI calls so the API key
// never ships to the browser. Reachable at /ai-proxy once deployed.
// The key is read from a server-side environment variable (GEMINI_API_KEY,
// set in Cloudflare Pages → Settings → Environment variables) — never
// prefixed with VITE_, so it's never bundled into client-side JS.

import { GoogleGenAI, Type } from '@google/genai';

export async function onRequestPost(context) {
  const { request, env } = context;

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return json({ error: 'Server missing GEMINI_API_KEY' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { action, payload } = body;
  const ai = new GoogleGenAI({ apiKey });

  try {
    switch (action) {
      case 'translateBusinessEntities': {
        const { names } = payload;
        if (!names || names.length === 0) return json({});
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Translate the following logistics entity names (Trucking companies, Shippers, Clients) to professional Arabic.
          Return a JSON object where keys are the original names and values are the Arabic translations.
          Names: ${names.join(', ')}`,
          config: { responseMimeType: 'application/json' },
        });
        return json(JSON.parse(response.text || '{}'));
      }

      case 'runThinkingAudit': {
        const { prompt, model, thinkingBudget } = payload;
        const response = await ai.models.generateContent({
          model: model || 'gemini-3-flash-preview',
          contents: prompt,
          config: { thinkingConfig: { thinkingBudget: thinkingBudget ?? 0 }, temperature: 0.2 },
        });
        return json({ text: response.text });
      }

      case 'scanImageForContainer': {
        const { base64Data } = payload;
        const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { inlineData: { data: cleanBase64, mimeType: 'image/jpeg' } },
              { text: "Extract the Container BIC code (4 letters + 7 digits). Return ONLY the code or 'NOT_FOUND'." },
            ],
          },
          config: { temperature: 0.1 },
        });
        return json({ text: response.text?.trim() || 'NOT_FOUND' });
      }

      case 'mapSpreadsheetToSchema': {
        const { csvData } = payload;
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `
            Role: Logistics Data Mapper. Convert CSV/Text to JSON.
            Instructions: Identify columns even if names are slightly different.
            Important: For every entity (customerName, beneficiaryName, trucker), provide its Arabic translation in a field suffixed with 'Ar'.
            Required Fields: customerName, customerNameAr, bookingNumber, containerNumber, gensetNumber, clipOnPort, clipOffPort, rate, operationDate, trucker, truckerAr, beneficiaryName, beneficiaryNameAr.
            Data: ${csvData}
          `,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  customerName: { type: Type.STRING },
                  customerNameAr: { type: Type.STRING },
                  bookingNumber: { type: Type.STRING },
                  containerNumber: { type: Type.STRING },
                  gensetNumber: { type: Type.STRING },
                  clipOnPort: { type: Type.STRING },
                  clipOffPort: { type: Type.STRING },
                  rate: { type: Type.STRING },
                  operationDate: { type: Type.STRING },
                  trucker: { type: Type.STRING },
                  truckerAr: { type: Type.STRING },
                  beneficiaryName: { type: Type.STRING },
                  beneficiaryNameAr: { type: Type.STRING },
                },
              },
            },
          },
        });
        return json(JSON.parse(response.text || '[]'));
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
