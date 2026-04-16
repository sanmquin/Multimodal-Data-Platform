import { Feature, TextFeatureEvaluation } from './types';
import { gemmaGenerate } from './gemma';
import { getPrompt } from './prompts';

/**
 * Evaluates how well given features describe a list of texts using Gemma.
 *
 * @param texts - The list of texts to evaluate.
 * @param features - The list of features to evaluate against.
 * @returns A promise resolving to a list of text feature evaluations.
 */
export async function evaluateFeatures(
  texts: string[],
  features: Feature[]
): Promise<TextFeatureEvaluation[]> {
  let prompt = getPrompt('evaluateFeatures') || '';
  prompt = prompt.replace('{{features}}', JSON.stringify(features, null, 2));
  prompt = prompt.replace('{{texts}}', JSON.stringify(texts, null, 2));

  try {
    const response = await gemmaGenerate(prompt, {
      systemInstruction: "You are an expert feature evaluation AI. Always output raw, valid JSON. Only return a JSON array."
    });

    let text = response.text.trim();
    if (text.startsWith('```json')) text = text.substring(7);
    if (text.startsWith('```')) text = text.substring(3);
    if (text.endsWith('```')) text = text.slice(0, -3);

    return JSON.parse(text.trim()) as TextFeatureEvaluation[];
  } catch (error) {
    console.error("Failed to evaluate features:", error);
    return [];
  }
}
