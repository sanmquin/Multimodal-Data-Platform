import { GoogleGenAI } from "@google/genai";
import { connectMongoose } from "./mongo";
import { getPromptModels } from "./models";

export interface GemmaOptions {
  apiKey?: string;
  model?: string;
  systemInstruction?: string;
  promptCategory?: string;
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logPrompt(category: string, model: string, prompt: string, result: any, elapsedTime: number) {
  try {
    if (await connectMongoose('mmdo')) {
      const { PromptModel } = getPromptModels('default');
      await PromptModel.create({ category, model, prompt, result, elapsedTime });
    }
  } catch (err) {
    console.error('Failed to log gemma prompt to Mongo:', err);
  }
}

export async function gemmaGenerate(
  prompt: string,
  options: GemmaOptions = {}
): Promise<GemmaResponse> {
  const {
    apiKey = process.env.GEMINI_API_KEY,
    model = 'gemma-4-26b-a4b-it',
    systemInstruction,
    promptCategory = 'default',
  } = options;

  if (!apiKey) {
    throw new Error('You must provide a GEMINI_API_KEY environment variable or pass an apiKey option.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const startTime = Date.now();
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    ...(systemInstruction ? { config: { systemInstruction } } : {}),
  });
  const elapsedTime = Date.now() - startTime;

  const text = response.text || '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let resultToStore: any = text;
  try {
    let cleanText = text.trim();
    if (cleanText.startsWith('```json')) cleanText = cleanText.substring(7);
    if (cleanText.startsWith('```')) cleanText = cleanText.substring(3);
    if (cleanText.endsWith('```')) cleanText = cleanText.slice(0, -3);
    resultToStore = JSON.parse(cleanText.trim());
  } catch {
    // Ignore and keep as string
  }

  logPrompt(promptCategory, model, prompt, resultToStore, elapsedTime);

  return {
    text,
  };
}
