
import { GoogleGenAI, Type } from "@google/genai";

// Fix: obtain API key exclusively from environment variable
export const getSafeApiKey = (): string | null => {
  return process.env.API_KEY || null;
};

// Fix: initialize client right before use
export const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

const handleApiError = (err: any) => {
  const msg = err?.message || "";
  // Fix: guidelines specify environment variable usage
  throw err;
};

/**
 * Specifically translates logistics entity names from English to Arabic.
 */
export const translateBusinessEntities = async (names: string[]) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || names.length === 0) return {};
  // Fix: create fresh instance per request
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Translate the following logistics entity names (Trucking companies, Shippers, Clients) to professional Arabic. 
      Return a JSON object where keys are the original names and values are the Arabic translations.
      Names: ${names.join(', ')}`,
      config: {
        responseMimeType: "application/json",
      },
    });
    // Fix: access text property directly
    return JSON.parse(response.text || '{}');
  } catch (e) {
    console.error("Translation Node Error", e);
    return {};
  }
};

export const runThinkingAudit = async (prompt: string, budget: number = 4000) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("AI Credentials Required.");
  // Fix: create fresh instance per request
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { 
        thinkingConfig: { thinkingBudget: 0 },
        temperature: 0.2
      }
    });
    // Fix: access text property directly
    return response.text;
  } catch (err) {
    return handleApiError(err);
  }
};

export const scanImageForContainer = async (base64Data: string) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return 'NOT_FOUND';
  // Fix: create fresh instance per request
  const ai = new GoogleGenAI({ apiKey });
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: cleanBase64, mimeType: 'image/jpeg' } },
          { text: "Extract the Container BIC code (4 letters + 7 digits). Return ONLY the code or 'NOT_FOUND'." }
        ],
      },
      config: { temperature: 0.1 }
    });
    // Fix: access text property directly and trim whitespace
    return response.text?.trim() || 'NOT_FOUND';
  } catch (err) {
    return 'ERROR';
  }
};

export const mapSpreadsheetToSchema = async (csvData: string): Promise<any[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return [];
  // Fix: create fresh instance per request
  const ai = new GoogleGenAI({ apiKey });

  try {
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
        responseMimeType: "application/json",
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
              beneficiaryNameAr: { type: Type.STRING }
            }
          }
        }
      }
    });
    // Fix: access text property directly and cast to any[]
    return JSON.parse(response.text || '[]') as any[];
  } catch (e) {
    return [];
  }
};
