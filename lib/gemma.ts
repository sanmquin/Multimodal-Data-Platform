import { GoogleGenAI } from "@google/genai";
import { connectMongoose } from "./mongo";
import { getPromptModels } from "./models";

export interface GemmaOptions {
  apiKey?: string;
  model?: string;
  systemInstruction?: string;
  promptCategory?: string;
  mongoDb?: string;
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
async function logPrompt(category: string, model: string, prompt: string, result: any, elapsedTime: number, mongoDb?: string) {
  if (!mongoDb) return;
  try {
    if (await connectMongoose(mongoDb)) {
      const { PromptModel } = getPromptModels('prompts');
      await PromptModel.create({ category, model, prompt, result, elapsedTime });
      console.log(`[logPrompt] Successfully saved gemma prompt (category: ${category}, model: ${model}) to ${mongoDb} database.`);
    } else {
      console.error(`[logPrompt] Failed to connect to Mongo database: ${mongoDb}. Prompt was not logged.`);
    }
  } catch (err) {
    console.error('[logPrompt] Failed to log gemma prompt to Mongo. Error details:', err);
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
    mongoDb,
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

  logPrompt(promptCategory, model, prompt, resultToStore, elapsedTime, mongoDb);

  return {
    text,
  };
}
