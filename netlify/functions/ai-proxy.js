// Netlify serverless function: proxies all Gemini AI calls so the API key
// never ships to the browser. The key is read from a server-side environment
// variable (GEMINI_API_KEY, set in Netlify site settings) — NOT prefixed with
// VITE_, so Vite never bundles it into client-side JS.

const { GoogleGenAI, Type } = require('@google/genai');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server missing GEMINI_API_KEY' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
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
        return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };
    }
  } catch (err) {
    console.error('AI proxy error', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'AI request failed' }) };
  }
};

function json(data) {
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
}
