import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mistralChat, verdaChat, verdaEmbed, safeJSONParse } from "./llm.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AuthedSupabase = SupabaseClient<Database>;

type RetrievedChunk = {
  id: string;
  article_id: string;
  title: string;
  annex_point: string | null;
  content: string;
  source_type: string;
  similarity: number;
};

async function retrieve(supabase: AuthedSupabase, query: string, k = 24): Promise<RetrievedChunk[]> {
  const [vec] = await verdaEmbed([query]);
  const { data, error } = await supabase.rpc("match_corpus_chunks", {
    query_embedding: `[${vec.join(",")}]` as unknown as never,
    match_count: k,
  });
  if (error) throw new Error(`Retrieval failed: ${error.message}`);
  return (data ?? []) as RetrievedChunk[];
}

function formatContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => {
      const cite = c.annex_point ? `${c.article_id} §${c.annex_point}` : c.article_id;
      const src = c.source_type === "guidance"
        ? "GUIDANCE"
        : c.source_type === "national"
          ? "NATIONAL"
          : c.source_type === "commentary"
            ? "COMMENTARY"
            : "LEGISLATION";
      return `[${i + 1}] [${src}] (${cite}) ${c.title}\n${c.content}`;
    })
    .join("\n\n");
}

/** Stage 1 — Extractor (Verda/Llama-8B): pull structured facts from the use-case. */
async function extractFacts(useCase: string) {
  const sys = `You extract structured facts from an AI use-case description for EU AI Act assessment. Output strict JSON with keys:
- purpose: one-sentence intended purpose
- modality: one of "text", "image", "video", "audio", "biometric", "tabular", "multimodal", "other"
- domain: short domain label (e.g. "education", "HR/recruitment", "consumer credit", "healthcare", "law enforcement", "marketing")
- deployment_context: short description of where/by whom it is used
- data_subjects: who is affected (e.g. "EU pupils", "job applicants", "consumers")
- decision_stakes: "low" | "medium" | "high"
- automation_level: "decision-support" | "automated-decision"
- biometric_or_emotion: boolean — does it process biometric data or infer emotions?
- workplace_or_education: boolean
- public_authority: boolean
- publicly_accessible_space: boolean — is it deployed in a publicly accessible space (airport, train/metro station, stadium, mall, street, square, public transport)?
- real_time_remote_biometric_id: boolean — does it perform real-time remote biometric identification of natural persons (e.g. live facial recognition against a watchlist or to flag unknown/unauthorised individuals)?
- law_enforcement_context: boolean — is it used by, on behalf of, or in close cooperation with police, border, customs, intelligence, or other security/law-enforcement authorities (including airport/transport security and private security acting under a public-safety mandate)?
- role_hint: "provider" | "deployer" | "both" | "unknown"
- missing_info: array of short strings — important facts not present in the description`;
  const out = await verdaChat({
    messages: [
      { role: "system", content: sys },
      { role: "user", content: useCase },
    ],
    temperature: 0,
    json: true,
    max_tokens: 1024,
  });
  return safeJSONParse<Record<string, unknown>>(out) ?? { raw: out };
}

/** Stage 2 — Council reasoning (Mistral large). Returns the structured assessment. */
async function councilAssess(useCase: string, facts: unknown, context: string) {
  const sys = `You are an expert legal panel assessing an AI use-case against the EU AI Act (Regulation 2024/1689). You receive: (a) the original use-case, (b) extracted facts, (c) retrieved excerpts from the Act, each tagged with a citation like "Art. 5" or "Annex III §4". You MUST cite using ONLY those tags.

Return STRICT JSON with this schema:
{
  "summary": string,                              // 2-3 sentence neutral summary
  "role_determination": "provider" | "deployer" | "both" | "unclear",
  "risk_tier": "prohibited" | "high" | "limited" | "minimal" | "gpai" | "unclear",
  "art5_banner": { "triggered": boolean, "letter": string | null, "rationale": string },
  "preliminary_assessment": {
    "rationale": string,                          // 4-8 sentences, neutral, no recommendations
    "annex_iii_point": string | null              // e.g. "Annex III §4" if applicable
  },
  "governance_observations": {
    "transparency_art50": string | null,          // duties under Art. 50 if any
    "deployer_duties_art26": string | null,
    "fria_art27_required": boolean,
    "art86_right_to_explanation": boolean,
    "value_chain_art25": string | null
  },
  "missing_info": string[],                       // facts that, if known, would change the conclusion
  "citations": [
    { "tag": string, "quote": string }            // tag MUST match one of the provided excerpt tags; quote is a short excerpt you used
  ],
  "confidence": {
    "risk_tier": number,                          // 0..1
    "role_determination": number,
    "overall": number
  }
}

Rules:
- If the use-case falls under any Article 5 prohibition, set art5_banner.triggered=true and risk_tier="prohibited". The Article 5(1) prohibitions are:
  (a) subliminal / purposefully manipulative / deceptive techniques causing significant harm;
  (b) exploitation of vulnerabilities (age, disability, social/economic situation) causing significant harm;
  (c) social scoring by or on behalf of public authorities leading to detrimental/disproportionate treatment;
  (d) predictive policing on individuals based solely on profiling or personality traits;
  (e) untargeted scraping of facial images from the internet or CCTV to build/expand facial-recognition databases;
  (f) inferring emotions of natural persons in workplaces or education (except medical/safety);
  (g) biometric categorisation deducing race, political opinions, union membership, religion, philosophical beliefs, sex life or sexual orientation;
  (h) real-time remote biometric identification in publicly accessible spaces for law-enforcement purposes — including airports, train/metro stations, stadiums, streets, squares, and public transport — UNLESS one of the three narrow exceptions (targeted search for specific victims of abduction/trafficking/sexual exploitation or missing persons; prevention of a specific, substantial and imminent threat to life or of a genuine and foreseeable terrorist attack; localisation/identification of a suspect of specific serious crimes listed in Annex II) is clearly met AND prior judicial or independent administrative authorisation has been obtained.
- "Law-enforcement purposes" in (h) is broad: it covers police, border/customs, intelligence services, AND airport/transport/critical-infrastructure security operators (public or private) acting on behalf of or in cooperation with such authorities to detect, identify or screen persons for security threats. A "threat-detection" or "unauthorised-person flagging" airport facial-recognition system that scans guests in real time falls squarely under (h) and is PROHIBITED unless one of the narrow exceptions plus judicial authorisation is documented.
- One-to-one biometric verification (confirming a specific person's claimed identity, e.g. matching a passenger's face to their own boarding-pass photo) is NOT (h); it is biometric verification and falls under Annex III §1 (high-risk) instead.
- When biometric/public-space/law-enforcement facts are ambiguous, prefer "prohibited" with a lower confidence and list the missing facts that would move it to "high", rather than defaulting to "high".
- Otherwise apply Article 6 + Annex III to determine high-risk.
- Generative/conversational AI without high-risk use is typically "limited" with Art. 50 transparency duties.
- Never invent citations. If you have insufficient grounding, lower confidence and list what's missing.`;

  const user = `## Use-case
${useCase}

## Extracted facts
${JSON.stringify(facts, null, 2)}

## Retrieved AI Act excerpts
${context}

Produce the JSON now.`;

  const out = await mistralChat({
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    temperature: 0.1,
    json: true,
    max_tokens: 3000,
  });
  return safeJSONParse<Record<string, unknown>>(out) ?? { raw: out };
}

/** Stage 3 — Verifier: ensure citations are grounded in the retrieved chunks. */
function verifyCitations(
  assessment: Record<string, unknown>,
  chunks: RetrievedChunk[],
): { assessment: Record<string, unknown>; verifier_notes: string[] } {
  const notes: string[] = [];
  const allowed = new Set(
    chunks.map((c) => (c.annex_point ? `${c.article_id} §${c.annex_point}` : c.article_id)),
  );
  const raw = assessment.citations;
  const cites = Array.isArray(raw) ? (raw as { tag: string; quote: string }[]) : [];
  const kept = cites.filter((c) => {
    // Allow exact match or just article match (drop §point).
    if (allowed.has(c.tag)) return true;
    const articleOnly = c.tag.split(" §")[0];
    return allowed.has(articleOnly) || [...allowed].some((a) => a.startsWith(articleOnly));
  });
  if (kept.length < cites.length) {
    notes.push(`Dropped ${cites.length - kept.length} ungrounded citation(s).`);
  }
  if (kept.length === 0) {
    notes.push("No grounded citations remained; confidence reduced.");
    const conf = (assessment.confidence as Record<string, number>) ?? {};
    assessment.confidence = {
      risk_tier: Math.min(conf.risk_tier ?? 0.5, 0.4),
      role_determination: Math.min(conf.role_determination ?? 0.5, 0.4),
      overall: Math.min(conf.overall ?? 0.5, 0.35),
    };
  }
  assessment.citations = kept;
  return { assessment, verifier_notes: notes };
}

/** Orchestrator — public server fn called by the UI. */
export const runAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        useCase: z.string().min(20).max(20000),
        title: z.string().min(1).max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;

    // 1. Create session + document.
    const { data: session, error: sErr } = await supabase
      .from("sessions")
      .insert({ user_id: userId, title: data.title ?? data.useCase.slice(0, 60), status: "running" })
      .select()
      .single();
    if (sErr || !session) throw new Error(`Session create failed: ${sErr?.message}`);

    await supabase.from("documents").insert({
      session_id: session.id,
      filename: "use-case.txt",
      content: data.useCase,
      file_type: "text/plain",
    });

    try {
      // 2. Extract facts.
      const facts = await extractFacts(data.useCase);

      // 3. Retrieve relevant Act excerpts.
      const retrievalQuery = `${data.useCase}\n\nFacts: ${JSON.stringify(facts).slice(0, 1000)}`;
      const chunks = await retrieve(supabase, retrievalQuery, 24);

      // 4. Council reasoning.
      const rawAssessment = await councilAssess(data.useCase, facts, formatContext(chunks));

      // 5. Verifier.
      const { assessment, verifier_notes } = verifyCitations(rawAssessment, chunks);

      // 6. Persist.
      const { data: saved, error: aErr } = await supabase
        .from("assessments")
        .insert({
          session_id: session.id,
          status: "final",
          summary: (assessment.summary as string) ?? null,
          facts: facts as never,
          preliminary_assessment: (assessment.preliminary_assessment ?? {}) as never,
          governance_observations: (assessment.governance_observations ?? {}) as never,
          missing_info: (assessment.missing_info ?? []) as never,
          citations: (assessment.citations ?? []) as never,
          confidence: (assessment.confidence ?? {}) as never,
          art5_banner: (assessment.art5_banner ?? {}) as never,
          role_determination: (assessment.role_determination as string) ?? null,
          risk_tier: (assessment.risk_tier as string) ?? null,
        })
        .select()
        .single();
      if (aErr) throw new Error(`Save failed: ${aErr.message}`);

      await supabase.from("sessions").update({ status: "complete" }).eq("id", session.id);

      return {
        sessionId: session.id,
        assessmentId: saved!.id,
        assessment: saved,
        retrieved: chunks.map((c) => ({
          tag: c.annex_point ? `${c.article_id} §${c.annex_point}` : c.article_id,
          title: c.title,
          source_type: c.source_type,
          similarity: c.similarity,
        })),
        verifier_notes,
      };
    } catch (err) {
      await supabase.from("sessions").update({ status: "error" }).eq("id", session.id);
      throw err;
    }
  });

/** List the current user's recent sessions with their assessments. */
export const listSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("sessions")
      .select("id, title, status, created_at, assessments(id, risk_tier, role_determination, summary, art5_banner)")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Fetch a single session + assessment for the report view. */
export const getSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: session, error } = await supabase
      .from("sessions")
      .select("*, documents(*), assessments(*)")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return session;
  });

/** Delete a single session (cascades to its documents + assessments via RLS-scoped ops). */
export const deleteSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Remove dependent rows first (no FK cascade declared).
    await supabase.from("assessments").delete().eq("session_id", data.id);
    await supabase.from("documents").delete().eq("session_id", data.id);
    const { error } = await supabase.from("sessions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Delete all sessions for the current user. */
export const clearSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows } = await supabase.from("sessions").select("id").eq("user_id", userId);
    const ids = (rows ?? []).map((r) => r.id);
    if (ids.length === 0) return { deleted: 0 };
    await supabase.from("assessments").delete().in("session_id", ids);
    await supabase.from("documents").delete().in("session_id", ids);
    const { error } = await supabase.from("sessions").delete().in("id", ids);
    if (error) throw new Error(error.message);
    return { deleted: ids.length };
  });

/** Pre-assessment: ask the small model whether the use-case has enough information
 *  to produce a defensible EU AI Act assessment, and if not, what's missing.
 *  Cheap call (Verda/Llama-8B), no DB writes. */
export const checkSufficiency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ useCase: z.string().min(1).max(20000) }).parse(d))
  .handler(async ({ data }) => {
    const sys = `You are a pre-flight checker for an EU AI Act assessment council. Your job is to decide whether a use-case description contains ENOUGH information for the council to produce a defensible preliminary opinion. Return STRICT JSON:
{
  "sufficient": boolean,                  // true if the council can proceed with reasonable confidence
  "score": number,                        // 0..1 readiness
  "coverage": {
    "purpose": boolean,                   // is the intended purpose clear?
    "users_and_affected": boolean,        // who deploys it and who is affected?
    "domain": boolean,                    // sector/context (HR, education, biometrics, …)
    "inputs_outputs": boolean,            // what data in, what is produced
    "automation_and_oversight": boolean,  // human-in-the-loop or automated decision?
    "role": boolean,                      // provider vs deployer clear?
    "geography": boolean                  // EU / Member State context
  },
  "missing_questions": string[],          // 3-6 short, concrete follow-up questions the user should answer
  "rationale": string                     // 1-2 sentences explaining the verdict
}

Be strict: a one-line description is NOT sufficient. A description that says only "we built a chatbot" or "we use AI for hiring" is NOT sufficient. Score 0.7+ only if at least purpose, users/affected persons, domain, and automation level are clear.`;
    const out = await verdaChat({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: data.useCase },
      ],
      temperature: 0,
      json: true,
      max_tokens: 700,
    });
    const parsed = safeJSONParse<{
      sufficient: boolean;
      score: number;
      coverage: Record<string, boolean>;
      missing_questions: string[];
      rationale: string;
    }>(out);
    return (
      parsed ?? {
        sufficient: false,
        score: 0,
        coverage: {},
        missing_questions: ["Could not parse pre-flight check; please add more detail and retry."],
        rationale: "Pre-flight parser failed.",
      }
    );
  });