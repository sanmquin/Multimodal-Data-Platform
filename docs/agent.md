# Multimodal Data Platform - Agentic Documentation

### Coding Guidelines

When modifying this repository, strictly adhere to the following coding guidelines:

1. **Modularity:** Maintain a modular file structure. Do not place all functionality in a single `index.ts` file. Group related functions into cohesive files (e.g., `embed.ts`, `utils.ts`, `cluster.ts`).
2. **Small Functions:** Keep functions small, focused, and testable. The configured ESLint rule `max-lines-per-function` enforces a strict 50-line maximum limit per function. If a function exceeds this limit, extract logical chunks into separate helper functions.
3. **Linting:** Code must pass the configured ESLint checks before being merged. Ensure you run `npx eslint lib` (or similar) to verify your code against our rules. Address all linting errors.