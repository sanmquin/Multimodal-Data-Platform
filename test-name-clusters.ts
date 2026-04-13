import { nameClusters } from './lib/index';
import * as gemma from './lib/gemma';

// Mock gemmaGenerate
const originalGemmaGenerate = gemma.gemmaGenerate;
(gemma as any).gemmaGenerate = async (prompt: string, options: any) => {
  console.log("Mock called with prompt:", prompt);
  return {
    text: JSON.stringify({
      name: "Fruit Cluster",
      description: "A cluster of fruits. Examples include apple and banana.",
      summary: "Various fruits."
    })
  };
};

async function run() {
  const clusters = [
    { texts: ["dog", "cat"] },
    { texts: ["apple", "banana", "cherry", "date"] },
    { texts: ["red", "blue", "green"] }
  ];

  const results = await nameClusters(clusters);
  console.log(JSON.stringify(results, null, 2));
}

run().catch(console.error);
