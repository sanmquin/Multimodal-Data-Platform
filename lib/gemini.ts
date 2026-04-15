import { GoogleGenAI, Schema } from "@google/genai";

export interface GeminiOptions {
  apiKey?: string;
  model?: string;
  systemInstruction?: string;
}

/**
 * Utility function to interact with Gemini models using the Gemini API, forcing JSON schema output.
 *
 * @param prompt - The input text prompt.
 * @param responseSchema - The JSON schema to enforce.
 * @param options - Configuration options for the API call.
 * @returns A promise that resolves to the parsed JSON response.
 */
export async function geminiGenerateJson(
  prompt: string,
  responseSchema: Schema,
  options: GeminiOptions = {}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const {
    apiKey = process.env.GEMINI_API_KEY,
    model = 'gemini-3.0-flash',
    systemInstruction,
  } = options;

  if (!apiKey) {
    throw new Error('You must provide a GEMINI_API_KEY environment variable or pass an apiKey option.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    }
  });

  const responseText = response.text || '';
  return JSON.parse(responseText);
}
