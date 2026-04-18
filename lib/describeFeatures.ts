import { Feature } from './types';
import { gemmaGenerate } from './gemma';
import { getPrompt } from './prompts';

/**
 * Extracts features from a list of texts using Gemma.
 *
 * @param texts - The list of texts to extract features from.
 * @returns A promise resolving to a list of features.
 */
export async function describeFeatures(texts: string[]): Promise<Feature[]> {
  let prompt = getPrompt('describeFeatures') || '';
  prompt = prompt.replace('{{texts}}', JSON.stringify(texts, null, 2));

  try {
    const response = await gemmaGenerate(prompt, {
      systemInstruction: "You are an expert feature extraction AI. Always output raw, valid JSON. Only return a JSON array.",
      promptCategory: 'describeFeatures'
    });

    let text = response.text.trim();
    if (text.startsWith('```json')) text = text.substring(7);
    if (text.startsWith('```')) text = text.substring(3);
    if (text.endsWith('```')) text = text.slice(0, -3);

    return JSON.parse(text.trim()) as Feature[];
  } catch (error) {
    console.error("Failed to describe features:", error);
    return [];
  }
}
