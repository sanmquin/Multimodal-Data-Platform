import { GoogleGenAI, Schema } from "@google/genai";
import { connectMongoose } from "./mongo";
import { getPromptModels } from "./models";

export interface GeminiOptions {
  apiKey?: string;
  model?: string;
  systemInstruction?: string;
  promptCategory?: string;
}

/**
 * Utility function to interact with Gemini models using the Gemini API, forcing JSON schema output.
 *
 * @param prompt - The input text prompt.
 * @param responseSchema - The JSON schema to enforce.
 * @param options - Configuration options for the API call.
 * @returns A promise that resolves to the parsed JSON response.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logPrompt(category: string, model: string, prompt: string, result: any, elapsedTime: number) {
  try {
    if (await connectMongoose('mm-dp')) {
      const { PromptModel } = getPromptModels('prompts');
      await PromptModel.create({ category, model, prompt, result, elapsedTime });
    } else {
      console.error('Failed to connect to Mongo database: mm-dp');
    }
  } catch (err) {
    console.error('Failed to log gemini prompt to Mongo:', err);
  }
}

export async function geminiGenerateJson(
  prompt: string,
  responseSchema: Schema,
  options: GeminiOptions = {}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const {
    apiKey = process.env.GEMINI_API_KEY,
    model = 'gemini-3-flash-preview',
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
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    }
  });
  const elapsedTime = Date.now() - startTime;

  const responseText = response.text || '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsedResult: any = responseText;
  try {
    parsedResult = JSON.parse(responseText);
  } catch {
    // Ignore, keep as string
  }

  logPrompt(promptCategory, model, prompt, parsedResult, elapsedTime);

  return parsedResult;
}
