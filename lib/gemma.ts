import { GoogleGenAI } from "@google/genai";

export interface GemmaOptions {
  apiKey?: string;
  model?: string;
  systemInstruction?: string;
}

export interface GemmaResponse {
  text: string;
}

/**
 * Utility function to interact with Gemma 3 and Gemma 4 models using the Gemini API.
 *
 * @param prompt - The input text prompt to send to the Gemma model.
 * @param options - Configuration options for the API call.
 * @returns A promise that resolves to the generated text response.
 */
export async function gemmaGenerate(
  prompt: string,
  options: GemmaOptions = {}
): Promise<GemmaResponse> {
  const {
    apiKey = process.env.GEMINI_API_KEY,
    model = 'gemma-4-26b-a4b-it',
    systemInstruction,
  } = options;

  if (!apiKey) {
    throw new Error('You must provide a GEMINI_API_KEY environment variable or pass an apiKey option.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    ...(systemInstruction ? { config: { systemInstruction } } : {}),
  });

  return {
    text: response.text || '',
  };
}
