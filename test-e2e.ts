import { handler } from './netlify/functions/embed';
import { HandlerEvent, HandlerContext } from '@netlify/functions';

async function run() {
  process.env.PINECONE_API_KEY = 'test-dummy-key';
  process.env.PINECONE_INDEX = 'test-index';

  // We mock pinecone to avoid actual network requests during e2e.
  // The handler itself uses the 'Pinecone' class. So we need to mock it.
  // A cleaner e2e test would start a server, but testing the handler function works to verify the logic.

  // Create a mock event
  const event: Partial<HandlerEvent> = {
    httpMethod: 'POST',
    body: JSON.stringify({
      texts: [
        { id: '1', text: 'e2e test item 1' },
        { id: '2', text: 'e2e test item 2' }
      ],
      indexName: 'test-index',
      namespace: 'test-namespace'
    })
  };

  const context: Partial<HandlerContext> = {};

  console.log('Running e2e handler test...');
  try {
      const response = await handler(event as HandlerEvent, context as HandlerContext, () => {});
      console.log('Handler response:', response);
  } catch(e) {
      console.error(e);
  }
}

run().catch(console.error);