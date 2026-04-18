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
  const basePrompt = getPrompt('evaluateFeatures') || '';
  const batchSize = 10;
  let allEvaluations: TextFeatureEvaluation[] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batchTexts = texts.slice(i, i + batchSize);
    let prompt = basePrompt.replace('{{features}}', JSON.stringify(features, null, 2));
    prompt = prompt.replace('{{texts}}', JSON.stringify(batchTexts, null, 2));

    console.log(`[evaluateFeatures] Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(texts.length / batchSize)}...`);

    try {
      const response = await gemmaGenerate(prompt, {
        systemInstruction: "You are an expert feature evaluation AI. Always output raw, valid JSON. Only return a JSON array."
      });

      let text = response.text.trim();
      if (text.startsWith('```json')) text = text.substring(7);
      if (text.startsWith('```')) text = text.substring(3);
      if (text.endsWith('```')) text = text.slice(0, -3);

      const evaluations = JSON.parse(text.trim()) as TextFeatureEvaluation[];
      allEvaluations = allEvaluations.concat(evaluations);
    } catch (error) {
      console.error(`Failed to evaluate features for batch starting at ${i}:`, error);
    }
  }

  return allEvaluations;
}
