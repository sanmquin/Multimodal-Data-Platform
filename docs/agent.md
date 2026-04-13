# Multimodal Data Platform - Agentic Documentation

If you are an LLM agent or automated tooling trying to reason about how this package works, refer to the following structure and behavior guarantees.

### Interface Signatures

```typescript
import { Index, RecordMetadata } from '@pinecone-database/pinecone';

export interface TextRecord {
  id: string; // The unique identifier for the text snippet
  text: string; // The text content to embed
  metadata?: RecordMetadata; // Optional Pinecone-compatible metadata
}

export interface EmbedStats {
  writes: number;    // Number of records successfully inserted into Pinecone
  errors: number;    // Number of records that failed during processing
  elapsedMs: number; // Total processing time in milliseconds
}

export interface EmbedOptions<T extends RecordMetadata = RecordMetadata> {
  index: Index<T>;  // Instance of the configured Pinecone Index target
  texts: TextRecord[]; // List of texts to check and embed
  embedder: (texts: string[]) => Promise<number[][]>; // External provider callback generating vectors
  batchSize?: number; // Size per chunk (defaults to 50)
}
```

### Behavioral Guarantees

1. **Deduplication:** For each chunk, the library calls `index.fetch(ids)`. Items that already exist in the index are skipped to prevent redundant embedding computation and token usage.
2. **Metadata Injection:** The `text` field from the `TextRecord` is automatically injected into the inserted vector's `metadata`. Thus, the inserted metadata object becomes `{ ...metadata, text }`.
3. **Chunking Mechanism:** The function batches incoming objects arrays according to `batchSize` (default: 50).
4. **Error Handling:** If an error occurs in a given batch (e.g., embedding provider timeout, Pinecone API 502), the error is caught, `stats.errors` increments by the size of that batch, and the process continues onto the next batch without halting.
5. **Generics:** By passing `Index<YourType>`, you preserve Pinecone generic type assertions in case you require strict type checking for existing metadata structure mappings.

### Coding Guidelines

When modifying this repository, strictly adhere to the following coding guidelines:

1. **Modularity:** Maintain a modular file structure. Do not place all functionality in a single `index.ts` file. Group related functions into cohesive files (e.g., `embed.ts`, `utils.ts`, `cluster.ts`).
2. **Small Functions:** Keep functions small, focused, and testable. The configured ESLint rule `max-lines-per-function` enforces a strict 50-line maximum limit per function. If a function exceeds this limit, extract logical chunks into separate helper functions.
3. **Linting:** Code must pass the configured ESLint checks before being merged. Ensure you run `npx eslint lib` (or similar) to verify your code against our rules. Address all linting errors.