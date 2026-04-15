# Multimodal Data Platform - Agentic Documentation

### Coding Guidelines

When modifying this repository, strictly adhere to the following coding guidelines:

1. **Modularity:** Maintain a modular file structure. Do not place all functionality in a single `index.ts` file. Group related functions into cohesive files (e.g., `embed.ts`, `utils.ts`, `cluster.ts`).
2. **Small Functions:** Keep functions small, focused, and testable. The configured ESLint rule `max-lines-per-function` enforces a strict 50-line maximum limit per function. If a function exceeds this limit, extract logical chunks into separate helper functions.
3. **Linting:** Code must pass the configured ESLint checks before being merged. Ensure you run `npx eslint lib` (or similar) to verify your code against our rules. Address all linting errors.
4. **Type Reusability:** Define interfaces and types in `lib/types.ts` instead of using inline types to promote clean code and reusability.
5. **CORS and OPTIONS Handling:** All Netlify serverless functions (e.g., in `netlify/functions/`) must explicitly handle `OPTIONS` requests and include standard CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`, `Access-Control-Allow-Methods`) in *all* responses (including error responses) to properly support cross-domain frontend applications.
