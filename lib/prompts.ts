export const prompts = [
  {
    name: 'nameClusters',
    description: 'Generates a name, detailed description, and a short summary for a given text cluster.',
    template: `{{context}}You are a helpful AI assistant. I will provide you with a list of texts belonging to a single cluster.
Please analyze the themes and subjects of these texts and provide:
1. A concise "name" for the cluster.
2. A "description" of the cluster that is a detailed explanation with concrete examples.
3. A short "summary" of the cluster that is a concise one-liner.{{avoidDuplicationInstructions}}

Respond ONLY with a valid JSON object with keys: "name", "description", and "summary". Do not include markdown formatting like \`\`\`json.

Cluster texts:
{{clusterTexts}}`
  },
  {
    name: 'refineClusters',
    description: 'Refines existing clusters into a Mutually Exclusive, Collectively Exhaustive (MECE) set.',
    template: `You are an expert taxonomist. Review the following clusters and their representative texts.
Please refine them into a Mutually Exclusive, Collectively Exhaustive (MECE) set of clusters.
You may merge similar clusters or split broad clusters.
Additionally, you MUST include one cluster named "Miscellaneous/Unknown" to catch outliers.
For each cluster, provide a "name", a "description" that is a detailed explanation with concrete examples, and a short "summary" that is a concise one-liner.

Input clusters:
{{clustersData}}`
  },
  {
    name: 'describeFeatures',
    description: 'Extracts features from a list of texts into a JSON array of features with names and descriptions.',
    template: `You are an expert feature extraction AI. Review the following texts and identify the key features described across them.
Respond ONLY with a valid JSON array. Each element in the array MUST be an object with:
- "name": A concise name for the feature.
- "description": A detailed explanation of the feature.

Do not include any markdown formatting such as \`\`\`json.

Texts:
{{texts}}`
  },
  {
    name: 'evaluateFeatures',
    description: 'Evaluates how well given features describe a list of texts.',
    template: `You are an expert feature evaluation AI. Review the following texts and evaluate how well each of the provided features describes each text.
For each text, assign a numerical score (e.g., from 0.0 to 1.0, or 0 to 100) indicating the relevance or presence of each feature.
Respond ONLY with a valid JSON array. Each element in the array MUST represent a text and its feature evaluations:
- "text": The text being evaluated.
- "evaluations": An array of objects, each containing:
  - "featureName": The name of the feature being evaluated.
  - "score": The numerical score assigned to this feature for this text.

Do not include any markdown formatting such as \`\`\`json.

Features:
{{features}}

Texts:
{{texts}}`
  }
];

export function getPrompt(name: string): string | undefined {
  return prompts.find((p) => p.name === name)?.template;
}
