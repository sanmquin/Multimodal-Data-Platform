# AI Agent Planning Context

This document is intended for AI agents (and human maintainers) that need enough context to propose and sequence the **next product and engineering features** for this repository.

It complements the endpoint-level docs (`embed.md`, `cluster.md`, `features.md`, etc.) by describing system boundaries, implementation realities, and high-impact opportunities.

---

## 1) Product Surface and Current Capabilities

The platform currently exposes six Netlify Function entry points:

1. **`/embed`**: Deduplicate, embed, optionally reduce dimensions, and optionally persist embedding artifacts.
2. **`/cluster`** (+ background): Embed (optional), cluster vectors, generate AI names/descriptions/summaries, and persist cluster artifacts.
3. **`/refine-clusters`** (+ background): Load latest cluster version, gather representative texts, generate a refined MECE taxonomy, and save a new version.
4. **`/features`** (+ background): Generate semantic features, score each text on those features, train per-feature regressions, and persist models/data.
5. **`/feature-inference`**: Load trained models and infer feature values for new texts.
6. **`/explain-performance`**: Infer a selected feature and compute Pearson correlation against user-provided outputs.

From a planning perspective, this means the repository already supports three major workflows:

- **Vector lifecycle** (embed, store, retrieve).
- **Unsupervised structure** (cluster + iterative taxonomy refinement).
- **Feature modeling lifecycle** (feature discovery -> scoring -> regression -> inference -> performance correlation).

---

## 2) Runtime Architecture (How Requests Actually Flow)

### Request pattern

- `embed`, `feature-inference`, and `explain-performance` are effectively synchronous in one function invocation.
- `cluster`, `refine-clusters`, and `features` are split into:
  - a **validator/dispatcher** endpoint returning `202`.
  - a **background worker endpoint** that executes the heavier pipeline.

### Dependency graph (high level)

- **Netlify Functions** are thin wrappers for validation + orchestration.
- **`lib/`** contains reusable business logic and model integrations.
- **External systems**:
  - Pinecone (vector storage + inference embedding when configured).
  - Gemini/Gemma models (text generation and structured output).
  - MongoDB (optional persistence of PCA, clusters, features, evaluations, correlations, prompts).

### Persistence model

Mongo collections are suffix-based and reused across pipelines, for example:

- Clustering: `_pca`, `_clusters`, `_items`.
- Embeddings: `_pca`, `_embeddings`.
- Features: `_pca`, `_features`, `_evaluations`, `_performance`.
- Prompts/logging: `_prompts`.

This schema strategy is simple and flexible, but implies **consistency and versioning rules must be enforced by convention** at call sites.

---

## 3) Core Modules You Should Read First

If you are planning a non-trivial feature, inspect these files first (in this order):

1. `lib/types.ts` — shared interfaces and payload primitives.
2. `lib/embed.ts` + `lib/embedAndReduce.ts` — embedding and dimensionality foundation.
3. `lib/embedAndCluster.ts` + `lib/refineClusters.ts` — clustering lifecycle.
4. `lib/pipelines/featurePipeline.ts` — feature generation/training orchestration.
5. `lib/pipelines/featureInference.ts` and `lib/pipelines/explainPerformance.ts` — inference + evaluation path.
6. `lib/models.ts` + `lib/mongo.ts` — persistence contracts and DB connection behavior.
7. `netlify/functions/*.ts` — external API contracts and CORS/method handling behavior.

---

## 4) Current Strengths (Useful for Planning)

- **Clear modular separation** between transport layer (functions) and business logic (`lib`).
- **Asynchronous background strategy** already implemented for long-running operations.
- **Pipeline composability**: inference reuses trained artifacts; explain-performance reuses inference.
- **Model-provider flexibility hooks** already exist (`embedder`, model names, cloud/region options).
- **Schema versioning primitives** exist for clusters (`version`) and categories (`categoryId`).

---

## 5) Known Gaps / Technical Debt to Consider

These are high-value opportunities for future implementation and planning:

1. **Job lifecycle visibility**
   - `202 Accepted` is returned, but there is no first-class job status API (`queued/running/succeeded/failed`).
   - Users currently depend on logs or direct DB inspection.

2. **Validation consistency and contract hardening**
   - Validation depth differs by endpoint.
   - Stronger runtime schema validation (and consistent error shapes) would improve reliability.

3. **Idempotency and replay safety**
   - Retriggering background endpoints may duplicate writes.
   - No explicit idempotency keys or deduplicated job ledger.

4. **Observability and metrics**
   - Console logs exist but no standardized metrics, traces, or latency/error dashboards.
   - Hard to compare pipeline quality over time.

5. **Data governance controls**
   - No explicit retention/TTL strategy in docs for large collections.
   - No documented PII handling workflow for `text` fields stored in metadata and Mongo.

6. **Testing breadth**
   - There is a basic test entrypoint, but no clearly documented matrix for endpoint contracts, regression quality, and failure-mode tests.

7. **Multi-tenant guardrails**
   - Tenant/category scoping is convention-driven (`categoryId`, collection prefix).
   - Formal tenant isolation patterns are not yet codified.

---

## 6) Recommended Feature Roadmap (Prioritized)

### Phase 1 (Immediate, highest leverage)

1. **Job tracking API + status store**
   - Add `jobId` in `202` responses.
   - Persist state transitions (`queued`, `running`, `completed`, `failed`) + error payloads.

2. **Shared request/response schema package**
   - Add centralized runtime validation for all function payloads.
   - Normalize response envelope format.

3. **Standardized observability instrumentation**
   - Correlation IDs across dispatcher/background functions.
   - Timing + error counters per pipeline stage.

### Phase 2 (Reliability and scale)

4. **Idempotent writes and dedupe keys**
   - Prevent duplicate results on retries.

5. **Retry policy + dead-letter strategy**
   - Structured retries for transient provider/network failures.

6. **Batch orchestration controls**
   - Configurable concurrency/rate limits per provider (Pinecone + Gemini/Gemma).

### Phase 3 (Model and product maturity)

7. **Quality evaluation framework**
   - Benchmarks for cluster coherence, feature stability, and regression quality drift.

8. **Prompt/version management API**
   - First-class storage and retrieval for prompt versions and model settings.

9. **Security and governance hardening**
   - PII redaction options, retention policies, and tenant-scoped access contracts.

---

## 7) Planning Heuristics for AI Agents

When planning a new feature, use this checklist:

1. **Boundary check**: Does it change API contract, pipeline internals, or persistence schema?
2. **Sync vs async**: Should this run in-request or as a background job?
3. **Artifact impact**: Which collections and model artifacts are read/written?
4. **Replay behavior**: What happens if the same request is retried?
5. **Failure mode**: Where can provider/network/model errors occur, and how are they surfaced?
6. **Measurability**: Which metrics/logs prove success and detect regressions?
7. **Backwards compatibility**: Can existing clients keep working without changes?

If uncertain, prefer additive changes:

- Add optional fields instead of replacing required fields.
- Add new collections rather than mutating old document shapes in-place.
- Add new endpoints for major semantic shifts instead of overloading existing ones.

---

## 8) Suggested Next Documentation Tasks

To keep planning quality high, next documentation improvements should include:

1. A machine-readable OpenAPI-style contract for each function.
2. Sequence diagrams for each major pipeline.
3. A migration/versioning policy for Mongo collection schemas.
4. An operational runbook for failed background jobs.
5. A benchmark guide with sample datasets and quality thresholds.

---

## 9) Quick "Where to Start" for Future Agents

- For **new API features**: start at `netlify/functions/` and then mirror options into the relevant `lib/` module.
- For **model or pipeline improvements**: start in `lib/pipelines/` and trace dependent modules.
- For **storage/reporting features**: start in `lib/models.ts` + `lib/mongo.ts`.
- For **developer UX/docs updates**: update `docs/*.md`, `README.md`, and `public/agent.md` together to prevent drift.

