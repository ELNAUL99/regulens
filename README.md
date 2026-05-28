# ReguLens

Multi-agent **EU AI Act (Regulation 2024/1689)** compliance triage for AI use-cases.

Describe an AI system in plain English, paste a public URL, or upload supporting documents (PDF / Word / Markdown). A team of specialised agents reads the inputs, decides whether more detail is needed, retrieves the governing articles from a built-in AI Act corpus, deliberates, red-teams its own conclusion, and returns a structured, **citation-grounded preliminary opinion** — with an explicit separation of facts, assumptions, references, and system reasoning.

> This is a decision-support tool for structured review, **not legal advice** and not a final compliance authority.

## What it produces

Every assessment answers, in order:

1. **Is this an AI system?** — explicit Art. 3(1) gate (five cumulative criteria). If it fails, the Act doesn't apply and the report says so.
2. **Use-case summary** — a neutral synthesis of all inputs.
3. **Extracted facts** — purpose, modality, domain, deployment context, data subjects, automation level, human oversight, AI-generated-content use, GPAI use, impact on people, and risk-relevant flags (biometrics, workplace, public space, law enforcement…).
4. **Preliminary risk classification** — prohibited (Art. 5) / high (Annex III + Art. 6) / limited / minimal / GPAI, with rationale and an Annex III point where relevant.
5. **Role determination** — provider / deployer / both / unclear, with confidence.
6. **Governance observations** — Art. 11 documentation, Art. 12 logging, Art. 14 human oversight, Art. 17 QMS, Art. 26 deployer duties, Art. 27 FRIA, Art. 50 transparency, Art. 72 post-market monitoring, Art. 73 incident reporting, Art. 86 right to explanation.
7. **GPAI obligations** — dedicated path (Art. 53 transparency, copyright, Art. 55 systemic risk).
8. **Adjacent frameworks** — flags GDPR / DSA / sector-specific rules that may also apply, clearly separated from the AI Act analysis.
9. **Red-team critique** — a second pass that argues the opposite risk tier and either confirms or recommends a revision.
10. **Assumptions, missing information, and follow-up questions.**
11. **Next-steps checklist** and **authorities cited** (each tagged Legislation / Guidance / National).

Reports export to **Markdown** or **PDF** (browser print), and every session supports **follow-up chat** plus a **"Revise opinion"** action that re-runs the council with new information.

## Stack

- **TanStack Start** (React 19, server functions, SSR) built with **Nitro**, deployed on **Vercel**
- **Supabase** — Postgres + **pgvector** + Auth + Row-Level Security
- **Mistral** (`mistral-large-latest`) — council reasoning, red-team critique, follow-up chat
- **Verda / DataCrunch** — `Llama-3.1-8B-Instruct` (leader, fact extraction, sufficiency check) and `bge-m3` embeddings (corpus + retrieval)
- **unpdf** — server-side PDF text extraction; **pdfjs-dist** (v4 legacy) — client-side extraction
- **shadcn/ui** + Tailwind v4, dark mode by default

## The agents

| Agent | Model | Responsibility | Autonomous decisions |
|---|---|---|---|
| **Leader** | Verda Llama-8B | Routes the request | "ready to convene" vs. "ask the user for more detail"; reports coverage + readiness |
| **Extractor** | Verda Llama-8B | Pulls structured facts from the synthesised inputs | which facts are present vs. missing |
| **Retriever** | bge-m3 + pgvector | Fetches the k=24 most relevant AI Act excerpts | similarity-ranked corpus selection |
| **Council** | Mistral large | Produces the preliminary opinion | risk tier, role, Art. 3(1) gate, governance, GPAI, assumptions |
| **Verifier** | (deterministic) | Drops ungrounded citations, attaches source types, lowers confidence when grounding is thin | citation grounding |
| **Red-team** | Mistral large | Argues the opposite risk tier | confirm vs. recommend-revise |

Agents exchange typed, Zod-validated intermediate outputs — it is not a fixed linear prompt chain. The leader can stop and ask; the verifier can weaken an over-confident verdict; the red-team can flag a revision; the user can feed new facts back in and re-run.

## Pipeline data flow

```
 user text / URL / uploaded docs
            │
            ▼  (server-side: URLs fetched + parsed, files extracted, inputs synthesised)
     ┌─────────────┐   not enough info     ┌──────────────────────┐
     │   Leader    │ ───────────────────▶  │  ask user (coverage  │
     │  (router)   │                        │  + follow-up qs)     │
     └──────┬──────┘                        └──────────────────────┘
            │ ready
            ▼
     ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
     │  Extractor  │───▶│  Retrieval  │───▶│   Council   │───▶│  Verifier   │───▶│  Red-team   │
     │   (facts)   │    │ (corpus k24)│    │  (opinion)  │    │ (citations) │    │ (critique)  │
     └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
            │                                                                          │
            └──────────────────────────────  persisted + rendered  ◀──────────────────┘
```

## Local setup

Prerequisites: Node 20+ (Node 22+ recommended), npm.

```bash
git clone https://github.com/ELNAUL99/regulens
cd regulens
cp .env.example .env       # fill in keys — see below
npm install
npm run dev                # http://localhost:8080
```

### Environment variables

| Var | Where | Notes |
|---|---|---|
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` | server | Anon/publishable key — RLS does the heavy lifting |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PROJECT_ID` | client | Same values, prefixed for Vite |
| `MISTRAL_API_KEY` | server | Council, red-team, chat |
| `VERDA_API_KEY` | server | DataCrunch bearer token (LLM + embeddings) |
| `VERDA_LLM_BASE_URL` | server | Default `https://containers.datacrunch.io/llama-3-1-8b/` |
| `VERDA_EMBED_BASE_URL` | server | Default `https://containers.datacrunch.io/bge-m3` |

There is **no `SUPABASE_SERVICE_ROLE_KEY`**. The app runs entirely under the signed-in user's RLS scope; the shared corpus tables have explicit write policies for any authenticated user.

## Database migrations

```bash
npx supabase link --project-ref <your-ref>
npx supabase db push
```

…or paste the SQL files under `supabase/migrations/` into the Supabase dashboard SQL editor in order. The tables: `sessions`, `documents`, `assessments`, `messages`, `corpus_chunks` (pgvector), `regression_tests`, `user_roles`.

## Seeding the EU AI Act corpus

Sign in, then use the **"Seed corpus"** button (or call the `seedCorpus` server function). It embeds every chunk in `src/lib/corpus-seed.server.ts` via Verda `bge-m3` and upserts into `corpus_chunks` (idempotent — safe to re-run, concurrent-safe). The seed covers the core Articles (3, 4, 5, 6, 25, 26, 27, 49, 50, 53, 86), all eight Annex III categories, Commission guidance (AI-system definition, prohibited practices, high-risk classification, GPAI Code of Practice), and Finnish national implementation context (TEM, Traficom, Valtioneuvosto).

> Seeding spends Verda embedding tokens each run.

## Deployment (Vercel)

The build uses the **Nitro** Vite plugin. On Vercel CI the `VERCEL` env var is set and Nitro auto-selects its `vercel` preset, emitting `.vercel/output/` which Vercel ingests directly — no `vercel.json` needed.

1. Import the repo at [vercel.com/new](https://vercel.com/new). Framework preset: **Other**.
2. Add the environment variables from the table above.
3. Deploy.
4. In Supabase → **Authentication → URL Configuration**, set the Site URL and Redirect URLs to your Vercel domain (`https://<project>.vercel.app` and `/**`) so email-confirmation links resolve to production rather than `localhost`.

Locally, `npm run build` produces a Node server you can preview with `npx vite preview`.

## Security posture

- **No service-role key** — all per-user writes go through the user's JWT, scoped by RLS.
- **Server-side URL fetching** with SSRF protection — http/https only, blocks loopback / RFC1918 / link-local / cloud-metadata targets, 10 MB cap, 15 s timeout, content-type whitelist.
- **Prompt-injection defence** — user text is wrapped in `<USER_SUBMISSION>…</USER_SUBMISSION>` with a system directive to treat it as data; close-tags are neutralised.
- **Schema validation** — every LLM JSON output round-trips through Zod before it is persisted, branched on, or rendered.
- **Timeouts + retries** — every LLM / embeddings call has a 60 s timeout and one retry on 429/5xx / transient network errors.
- **`.env` is gitignored**; only `.env.example` is committed.

Still open for production hardening: per-user rate limiting on `runAssessment` / `seedCorpus`, audit logging for corpus mutations, and a cleanup job for orphaned `error`-state sessions.

## Project layout

```
src/
├── routes/                       __root, index (dashboard + landing), login
├── lib/
│   ├── leader.functions.ts       Leader router agent
│   ├── assessment.functions.ts   Orchestrator, council, verifier, red-team, revise
│   ├── chat.functions.ts         Follow-up chat
│   ├── corpus.functions.ts       Corpus seed + status
│   ├── corpus-seed.server.ts     EU AI Act corpus payload
│   ├── url-fetch.server.ts       Server-side URL fetch + PDF/HTML extraction (SSRF-guarded)
│   ├── extract-files.ts          Client-side PDF/DOCX/MD/TXT extraction
│   ├── llm.server.ts             Mistral + Verda clients, timeouts, retries, injection helpers
│   └── assessment-schemas.ts     Zod schemas for every LLM output
├── integrations/supabase/        client, auth-middleware, auth-attacher, types
├── components/
│   ├── assessment-report.tsx     The full opinion view + exports
│   ├── follow-up-chat.tsx        Chat + "Revise opinion"
│   ├── theme-toggle.tsx          Dark/light toggle
│   └── ui/                       shadcn/ui primitives
└── hooks/use-theme.ts            Theme persistence
```

## Scripts

```bash
npm run dev          # vite dev, http://localhost:8080
npm run build        # production build (Nitro → Vercel / Node)
npm run preview      # preview the built server
npm run lint         # eslint
npm run format       # prettier
```

## License

Private — internal use only unless and until you say otherwise.
