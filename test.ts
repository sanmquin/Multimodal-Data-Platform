import { embed, EmbedOptions } from './lib/index';

async function run() {
  const mockIndex: any = {
    fetch: async ({ ids }: { ids: string[] }) => {
      // Mock existing id
      if (ids.includes('2')) {
        return { records: { '2': {} } };
      }
      return { records: {} };
    },
    upsert: async ({ records }: { records: any[] }) => {
      console.log('Upserting:', JSON.stringify(records, null, 2));
      return;
    }
  };

  const options: EmbedOptions = {
    index: mockIndex,
    texts: [
      { id: '1', text: 'First item' },
      { id: '2', text: 'Second item' }, // Should be skipped due to mock fetch returning it
      { id: '3', text: 'Third item' },
    ],
    embedder: async (texts: string[]) => {
      return texts.map(t => [Math.random(), Math.random(), Math.random()]);
    },
    batchSize: 2
  };

  const stats = await embed(options);
  console.log('Stats:', stats);
}

run().catch(console.error);
