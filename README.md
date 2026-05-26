# ReguLens

Multi-agent EU AI Act (Regulation 2024/1689) compliance triage for AI use-cases.

A user describes an AI system in plain English; a leader agent decides whether the submission is detailed enough to assess; a six-stage pipeline (intake → fact extraction → corpus retrieval → council reasoning → citation verification → reporting) produces a structured preliminary assessment with grounded citations to the Act.

## Stack

- **TanStack Start** (React 19, server functions, SSR) on **Cloudflare Workers** for production builds
- **Supabase** (Postgres + pgvector + Auth + RLS)
- **Mistral** (`mistral-large-latest`) for the council reasoning step and follow-up chat
- **Verda / DataCrunch** (`Llama-3.1-8B-Instruct` + `bge-m3` embeddings) for the leader, fact extraction, and the EU AI Act corpus embeddings
- **shadcn/ui** + Tailwind v4

## Local setup

Prerequisites: Node 20+ (Node 22+ recommended), npm.

```bash
git clone <your-fork-url>
cd ReguLens
cp .env.example .env       # fill in keys — see below
npm install
npm run dev                # http://localhost:8080
```

### Required environment variables

| Var | Where used | Notes |
|---|---|---|
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` | Server side (auth middleware) | Anon key — RLS does the heavy lifting |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PROJECT_ID` | Client side | Same values, prefixed for Vite |
| `MISTRAL_API_KEY` | Server side | Council assessment + follow-up chat |
| `VERDA_API_KEY` | Server side | DataCrunch bearer token, used for both LLM + embeddings |
| `VERDA_LLM_BASE_URL` | Server side | Default `https://containers.datacrunch.io/llama-3-1-8b/` |
| `VERDA_EMBED_BASE_URL` | Server side | Default `https://containers.datacrunch.io/bge-m3` |

There is no `SUPABASE_SERVICE_ROLE_KEY`. The app runs entirely under the user's RLS scope; the corpus tables have explicit write policies for any authenticated user (see `supabase/migrations/20260526140000_drop_service_role_open_corpus.sql`).

## Database migrations

```bash
npx supabase link --project-ref <your-ref>
npx supabase db push
```

…or paste the SQL files under `supabase/migrations/` into the Supabase dashboard SQL editor in order. The key migration to apply if you're upgrading from the original Lovable-generated schema is `20260526140000_drop_service_role_open_corpus.sql`, which:

- adds INSERT/UPDATE/DELETE policies on `corpus_chunks` and `regression_tests` for `authenticated` users
- adds `UNIQUE (article_id, annex_point) NULLS NOT DISTINCT` so the seeder can upsert idempotently
- adds `UNIQUE (regression_tests.name)` for the same reason

## Seeding the EU AI Act corpus

Any authenticated user can trigger the seeder from the UI (or by calling the `seedCorpus` server function). It embeds every chunk in `src/lib/corpus-seed.server.ts` via Verda `bge-m3` and upserts them into `corpus_chunks`. Concurrent seeds are safe.

Seeding burns Verda embedding tokens every time. If you fork the corpus, consider exposing the seeder only behind a debug flag.

## Architecture

```
src/
├── routes/                    TanStack Start routes (__root, index, login)
├── lib/
│   ├── leader.functions.ts    Leader: route to "assessment" or "ask_user"
│   ├── assessment.functions.ts  Council pipeline + persistence
│   ├── chat.functions.ts      Follow-up chat grounded in the assessment
│   ├── corpus.functions.ts    Corpus seed + status
│   ├── corpus-seed.server.ts  EU AI Act corpus payload
│   ├── llm.server.ts          Mistral + Verda clients, timeouts, retries, prompt-injection helpers
│   └── assessment-schemas.ts  Zod schemas validating every LLM output
├── integrations/supabase/
│   ├── client.ts              Browser Supabase client
│   ├── auth-middleware.ts     Server-fn middleware: verifies the JWT, injects ctx.supabase
│   ├── auth-attacher.ts       Browser-side middleware: attaches the JWT to RPC calls
│   └── types.ts               Generated Database types
└── components/
    ├── assessment-report.tsx  Final assessment view
    ├── follow-up-chat.tsx     Chat panel
    └── ui/                    shadcn/ui primitives
```

## Pipeline data flow

```
                   ┌────────────────────────────┐
   user prompt ───▶│ leader (Verda Llama-8B)   │
                   │  decides next agent       │
                   └─────────┬─────────────────┘
                             │ "assessment"
                             ▼
                   ┌────────────────────────────┐
                   │ extractor (Verda Llama-8B)│
                   │  structured facts (Zod)    │
                   └─────────┬─────────────────┘
                             ▼
                   ┌────────────────────────────┐
                   │ retrieval (bge-m3 + pgvec)│
                   │  k=24 corpus chunks        │
                   └─────────┬─────────────────┘
                             ▼
                   ┌────────────────────────────┐
                   │ council (Mistral large)   │
                   │  preliminary opinion (Zod) │
                   └─────────┬─────────────────┘
                             ▼
                   ┌────────────────────────────┐
                   │ verifier                  │
                   │  drops ungrounded cites    │
                   └─────────┬─────────────────┘
                             ▼
                          persisted
```

Every LLM output is validated against a Zod schema in `assessment-schemas.ts` before it is persisted or branched on. Council output that fails validation aborts the run; cheaper agents (leader, extractor, sufficiency check) return a structured fallback so the UI can recover.

## Security posture

- **No service role key**: all per-user writes go through the user's JWT and are scoped by RLS. The corpus tables have explicit policies for authenticated writes.
- **Prompt-injection wrapping**: every prompt that interpolates user text wraps it in `<USER_SUBMISSION>…</USER_SUBMISSION>` and sets a system-prompt directive instructing the model to treat that block as data. Close-tags in user input are neutralised.
- **Schema validation**: every LLM JSON output is Zod-validated before reaching the database or the UI.
- **Timeouts + retries**: every LLM/embeddings call has a 60-second timeout and one retry on 429/5xx / transient network errors.
- **`.env` is gitignored**; only `.env.example` lives in version control.

What's still missing for production: per-user rate limiting on `runAssessment` and `seedCorpus`, audit logging for corpus mutations, and a cleanup job for orphaned partial sessions. See the inline review notes in the code.

## Scripts

```bash
npm run dev          # vite dev, http://localhost:8080
npm run build        # production build (Cloudflare Workers adapter)
npm run preview      # preview the built bundle
npm run lint         # eslint
npm run format       # prettier
```

## Deploy (Cloudflare Workers)

`wrangler.jsonc` is wired for `@cloudflare/vite-plugin`. Set the same env vars as the `.env` (without the `VITE_*` duplicates — those are inlined at build) in the Workers dashboard or via `wrangler secret put`. Then:

```bash
npm run build
npx wrangler deploy
```

## License

Private — internal use only unless and until you say otherwise.
