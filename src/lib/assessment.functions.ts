import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  mistralChat,
  verdaChat,
  verdaEmbed,
  safeJSONParse,
  wrapUntrustedInput,
  UNTRUSTED_INPUT_DIRECTIVE,
} from "./llm.server";
import {
  AssessmentSchema,
  CritiqueSchema,
  FactsSchema,
  SufficiencySchema,
  validate,
  type Assessment,
  type Critique,
  type Facts,
} from "./assessment-schemas";
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
async function extractFacts(useCase: string): Promise<Facts> {
  const sys = `You extract structured facts from an AI use-case description for EU AI Act assessment. Output strict JSON with keys:
- purpose: one-sentence intended purpose
- modality: one of "text", "image", "video", "audio", "biometric", "tabular", "multimodal", "other"
- domain: short domain label (e.g. "education", "HR/recruitment", "consumer credit", "healthcare", "law enforcement", "marketing")
- deployment_context: short description of where/by whom it is used
- data_subjects: who is affected (e.g. "EU pupils", "job applicants", "consumers")
- decision_stakes: "low" | "medium" | "high"
- automation_level: "decision-support" | "automated-decision"
- human_oversight: short string — how humans review or override outputs ("none" / "approve each output" / "spot-check" / etc.)
- biometric_or_emotion: boolean — does it process biometric data or infer emotions?
- workplace_or_education: boolean
- public_authority: boolean
- publicly_accessible_space: boolean — is it deployed in a publicly accessible space (airport, train/metro station, stadium, mall, street, square, public transport)?
- real_time_remote_biometric_id: boolean — does it perform real-time remote biometric identification of natural persons (e.g. live facial recognition against a watchlist or to flag unknown/unauthorised individuals)?
- law_enforcement_context: boolean — is it used by, on behalf of, or in close cooperation with police, border, customs, intelligence, or other security/law-enforcement authorities (including airport/transport security and private security acting under a public-safety mandate)?
- ai_generated_content: boolean — does the system generate or substantially alter text, images, audio, or video that could appear as authentic content (Art. 50(4) labelling)?
- gpai_use: boolean — does the system rely on or integrate a general-purpose AI model (e.g. GPT-class LLM, image-generation foundation model)?
- gpai_role: "provider" | "downstream-deployer" | "none" | "unknown" — provider if the entity trains/places-on-market the GPAI itself; downstream-deployer if it merely integrates someone else's GPAI
- impact_on_people: short string — concrete impact on natural persons (e.g. "may affect job offers", "denies access to credit", "no individual impact").
- role_hint: "provider" | "deployer" | "both" | "unknown"
- missing_info: array of short strings — important facts not present in the description

Guidance on role_hint:
- "provider"  = the entity DEVELOPS the AI system (or has it developed) and places it on the market or puts it into service under its own name.
- "deployer"  = the entity USES the AI system under its own authority.
- "both"      = the SAME entity both develops AND operates the system itself (e.g. a consultancy that builds a model and also runs / hosts / monitors / retrains it on behalf of clients, or a SaaS vendor that both ships and operates the service). Vendor case studies often describe this pattern — do not default to "provider" if the description also shows operating, managed-service, hosting, monitoring, or retraining responsibilities.
- "unknown"   = the description is silent on who develops vs operates.${UNTRUSTED_INPUT_DIRECTIVE}`;
  const out = await verdaChat({
    messages: [
      { role: "system", content: sys },
      { role: "user", content: wrapUntrustedInput(useCase) },
    ],
    temperature: 0,
    json: true,
    max_tokens: 1024,
  });
  const parsed = safeJSONParse(out);
  const result = validate(FactsSchema, parsed);
  if (!result.ok) {
    console.warn(`[extractFacts] invalid LLM output: ${result.reason}`);
    return {};
  }
  return result.value;
}

/** Stage 2 — Council reasoning (Mistral large). Returns the structured assessment. */
async function councilAssess(
  useCase: string,
  facts: unknown,
  context: string,
): Promise<{ ok: true; assessment: Assessment } | { ok: false; reason: string }> {
  const sys = `You are an expert legal panel assessing an AI use-case against the EU AI Act (Regulation 2024/1689). You receive: (a) the original use-case, (b) extracted facts, (c) retrieved excerpts from the Act, each tagged with a citation like "Art. 5" or "Annex III §4". You MUST cite using ONLY those tags.

Return STRICT JSON with this schema:
{
  "summary": string,                              // 2-3 sentence neutral summary
  "is_ai_system": {                               // gate per Art. 3(1)
    "qualifies": boolean,
    "rationale": string                           // 2-3 sentences mapping to the Art. 3(1) criteria
  },
  "role_determination": "provider" | "deployer" | "both" | "unclear",
  "risk_tier": "prohibited" | "high" | "limited" | "minimal" | "gpai" | "unclear",
  "art5_banner": { "triggered": boolean, "letter": string | null, "rationale": string },
  "preliminary_assessment": {
    "rationale": string,                          // 4-8 sentences, neutral, no recommendations
    "annex_iii_point": string | null              // e.g. "Annex III §4" if applicable
  },
  "governance_observations": {
    "transparency_art50": string | null,                  // user-facing transparency (chatbots, deepfakes, AI-generated content)
    "deployer_duties_art26": string | null,               // logging, monitoring, instructions for use, AI literacy, notice to workers
    "fria_art27_required": boolean,                       // Fundamental Rights Impact Assessment for public bodies / certain high-risk
    "art86_right_to_explanation": boolean,                // right to an explanation of individual decision
    "value_chain_art25": string | null,                   // provider / distributor / importer / authorised representative duties
    "technical_documentation_art11": string | null,       // Annex IV technical documentation duties for high-risk providers
    "record_keeping_art12": string | null,                // automatic event logging / traceability
    "human_oversight_art14": string | null,               // human-in-the-loop measures (stop button, escalation, review)
    "quality_management_art17": string | null,            // QMS for high-risk providers
    "post_market_monitoring_art72": string | null,        // post-market monitoring system
    "serious_incident_reporting_art73": string | null     // 15-day reporting of serious incidents
  },
  "gpai_obligations": {                           // dedicated GPAI path; set applies=false and role="none" if not a GPAI scenario
    "applies": boolean,
    "role": "provider" | "downstream-deployer" | "none",
    "transparency_art53": string | null,          // Art. 53 GPAI provider duties (technical doc, training-data summary)
    "copyright_compliance": string | null,        // Art. 53(1)(c) copyright policy
    "systemic_risk_art55": string | null,         // Art. 55 systemic-risk model duties
    "notes": string | null
  },
  "adjacent_frameworks": [                        // bonus: GDPR / DSA / sector-specific rules that may also apply
    { "framework": string, "relevance": string }
  ],
  "assumptions": string[],                        // explicit assumptions the council made due to gaps in the input
  "next_steps": [                                 // actionable checklist derived from governance + missing info
    { "item": string, "basis": string, "priority": "high" | "medium" | "low" }
  ],
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
- FIRST, decide whether the described technology qualifies as an AI system under Article 3(1). The five cumulative criteria are: (i) machine-based, (ii) designed to operate with varying levels of autonomy, (iii) may exhibit adaptiveness after deployment, (iv) for explicit or implicit objectives, infers from inputs how to generate outputs (predictions, content, recommendations, decisions), (v) those outputs can influence physical or virtual environments. Pure rule-based systems with no learned inference, basic statistical reporting, plain optimisation, and deterministic spreadsheet logic do NOT qualify on their own. If the system clearly fails one or more criteria, set is_ai_system.qualifies=false, set risk_tier="minimal", set art5_banner.triggered=false, and explain in is_ai_system.rationale which criterion fails — the rest of the assessment can then be brief.
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
- Never invent citations. If you have insufficient grounding, lower confidence and list what's missing.
- For role_determination: return "both" when the SAME entity both DEVELOPS the system AND OPERATES it under its own authority (typical for consultancies that build + run a model for clients, or SaaS vendors that ship + host the service). Do not default to "provider" merely because the entity built the system — if the description also mentions operating, hosting, managed service, monitoring, retraining, or running the system on behalf of others, that is the deployer side and the correct answer is "both". Use the extracted facts' role_hint as a signal but override it when the description clearly shows both sides.${UNTRUSTED_INPUT_DIRECTIVE}`;

  const user = `## Use-case (untrusted user submission)
${wrapUntrustedInput(useCase)}

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
  const parsed = safeJSONParse(out);
  const result = validate(AssessmentSchema, parsed);
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  return { ok: true, assessment: result.value };
}

/**
 * Stage 3a — Red-team critique (Mistral). Argues the OPPOSITE risk tier and
 * either confirms or recommends a revision. Cheap second-opinion pass; its
 * output is shown in the report so a reviewer can see the counter-case.
 */
async function redTeamCritique(
  useCase: string,
  facts: unknown,
  context: string,
  council: Assessment,
): Promise<Critique | null> {
  // Pick the most defensible counter-tier: if council said high → challenge "limited" or "prohibited"; if minimal → challenge "high"; etc.
  const opposite: Record<string, string> = {
    prohibited: "high",
    high: "minimal",
    limited: "high",
    minimal: "high",
    gpai: "high",
    unclear: "high",
  };
  const challenge = opposite[council.risk_tier] ?? "high";

  const sys = `You are a RED-TEAM critic for an EU AI Act assessment. The council has produced an opinion. Your job is to argue the strongest possible case for a DIFFERENT risk_tier ("${challenge}") and surface weaknesses in the council's reasoning. Then deliver a verdict: "confirm" (council was right) or "revise" (you found a real problem).

Return STRICT JSON:
{
  "challenged_risk_tier": "prohibited" | "high" | "limited" | "minimal" | "gpai" | "unclear",
  "steel_man": string,                            // the strongest case for the challenged tier, in 2-3 sentences, citing only the provided AI Act excerpts by tag
  "weaknesses_found": string[],                   // specific weaknesses in the council's reasoning (ungrounded inferences, missed Annex III categories, etc.)
  "verdict": "confirm" | "revise",
  "recommended_risk_tier": "prohibited" | "high" | "limited" | "minimal" | "gpai" | "unclear" | null,  // null if verdict="confirm"
  "recommended_changes": string[]                 // [] if verdict="confirm"
}

Rules:
- Cite only the AI Act excerpt tags provided. Never invent.
- "confirm" the council if the steel-man does not hold up under the provided excerpts.
- "revise" only when you find a concrete, citation-grounded problem.${UNTRUSTED_INPUT_DIRECTIVE}`;

  const user = `## Use-case (untrusted user submission)
${wrapUntrustedInput(useCase)}

## Extracted facts
${JSON.stringify(facts, null, 2)}

## Council opinion
${JSON.stringify(
    {
      risk_tier: council.risk_tier,
      role_determination: council.role_determination,
      art5_banner: council.art5_banner,
      preliminary_assessment: council.preliminary_assessment,
      citations: council.citations,
      confidence: council.confidence,
    },
    null,
    2,
  )}

## Retrieved AI Act excerpts
${context}

Argue the case for risk_tier="${challenge}" and then deliver your verdict.`;

  const out = await mistralChat({
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    json: true,
    max_tokens: 1800,
  });
  const parsed = safeJSONParse(out);
  const result = validate(CritiqueSchema, parsed);
  if (!result.ok) {
    console.warn(`[redTeam] invalid LLM output: ${result.reason}`);
    return null;
  }
  return result.value;
}

/** Stage 3 — Verifier: ensure citations are grounded in the retrieved chunks
 *  and enrich each citation with its source_type so the UI can badge it. */
function verifyCitations(
  assessment: Assessment,
  chunks: RetrievedChunk[],
): { assessment: Assessment; verifier_notes: string[] } {
  const notes: string[] = [];
  const tagToSource = new Map<string, string>();
  const allowed = new Set<string>();
  for (const c of chunks) {
    const fullTag = c.annex_point ? `${c.article_id} §${c.annex_point}` : c.article_id;
    allowed.add(fullTag);
    tagToSource.set(fullTag, c.source_type);
    if (!tagToSource.has(c.article_id)) tagToSource.set(c.article_id, c.source_type);
  }
  const cites = assessment.citations;
  const kept = cites
    .filter((c) => {
      // Allow exact match or just article match (drop §point).
      if (allowed.has(c.tag)) return true;
      const articleOnly = c.tag.split(" §")[0];
      return allowed.has(articleOnly) || [...allowed].some((a) => a.startsWith(articleOnly));
    })
    .map((c) => {
      // Attach source_type so the UI can render "Legislation / Guidance /
      // National" badges next to each citation.
      const source =
        tagToSource.get(c.tag) ?? tagToSource.get(c.tag.split(" §")[0]) ?? "regulation";
      return { ...c, source_type: source } as typeof c & { source_type: string };
    });
  if (kept.length < cites.length) {
    notes.push(`Dropped ${cites.length - kept.length} ungrounded citation(s).`);
  }
  if (kept.length === 0) {
    notes.push("No grounded citations remained; confidence reduced.");
    const conf = assessment.confidence;
    assessment.confidence = {
      risk_tier: Math.min(conf.risk_tier, 0.4),
      role_determination: Math.min(conf.role_determination, 0.4),
      overall: Math.min(conf.overall, 0.35),
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
      const council = await councilAssess(data.useCase, facts, formatContext(chunks));
      if (!council.ok) {
        throw new Error(`Council output failed validation: ${council.reason}`);
      }

      // 5. Verifier.
      const { assessment, verifier_notes } = verifyCitations(council.assessment, chunks);

      // 5a. Red-team critique (parallel-safe to run after verifier).
      const critique = await redTeamCritique(
        data.useCase,
        facts,
        formatContext(chunks),
        assessment,
      );

      // 6. Persist.
      const { data: saved, error: aErr } = await supabase
        .from("assessments")
        .insert({
          session_id: session.id,
          status: "final",
          summary: assessment.summary,
          facts: facts as never,
          // Fold the Art. 3(1) gate into preliminary_assessment so we don't
          // need a DB column for it. The UI reads it back from the same blob.
          // Fold the Art. 3(1) gate, GPAI obligations, adjacent frameworks,
          // assumptions, and next-steps checklist into preliminary_assessment
          // JSONB so we don't need new DB columns. The UI reads them back from
          // the same blob.
          preliminary_assessment: {
            ...assessment.preliminary_assessment,
            is_ai_system: assessment.is_ai_system,
            gpai_obligations: assessment.gpai_obligations,
            adjacent_frameworks: assessment.adjacent_frameworks,
            assumptions: assessment.assumptions,
            next_steps: assessment.next_steps,
            critique,
          } as never,
          governance_observations: assessment.governance_observations as never,
          missing_info: assessment.missing_info as never,
          citations: assessment.citations as never,
          confidence: assessment.confidence as never,
          art5_banner: assessment.art5_banner as never,
          role_determination: assessment.role_determination,
          risk_tier: assessment.risk_tier,
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

/**
 * Re-run the council for an existing session, folding in additional context
 * the user supplied in chat. Stores a NEW assessment row so the original
 * stays as a baseline for comparison.
 */
export const reviseAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        sessionId: z.string().uuid(),
        additionalContext: z.string().min(1).max(8000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load the session + original document.
    const { data: session, error: sErr } = await supabase
      .from("sessions")
      .select("id, user_id, documents(content)")
      .eq("id", data.sessionId)
      .single();
    if (sErr || !session) throw new Error("Session not found");
    if (session.user_id !== userId) throw new Error("Forbidden");
    const doc = Array.isArray(session.documents) ? session.documents[0] : session.documents;
    const original = (doc?.content as string | undefined) ?? "";

    const merged =
      `${original}\n\n--- Additional information supplied by the user ---\n${data.additionalContext}`.slice(
        0,
        20_000,
      );

    // Re-run the pipeline.
    const facts = await extractFacts(merged);
    const chunks = await retrieve(
      supabase,
      `${merged}\n\nFacts: ${JSON.stringify(facts).slice(0, 1000)}`,
      24,
    );
    const council = await councilAssess(merged, facts, formatContext(chunks));
    if (!council.ok) {
      throw new Error(`Council output failed validation: ${council.reason}`);
    }
    const { assessment, verifier_notes } = verifyCitations(council.assessment, chunks);
    const critique = await redTeamCritique(merged, facts, formatContext(chunks), assessment);

    const { data: saved, error: aErr } = await supabase
      .from("assessments")
      .insert({
        session_id: session.id,
        status: "revised",
        summary: assessment.summary,
        facts: facts as never,
        preliminary_assessment: {
          ...assessment.preliminary_assessment,
          is_ai_system: assessment.is_ai_system,
          gpai_obligations: assessment.gpai_obligations,
          adjacent_frameworks: assessment.adjacent_frameworks,
          assumptions: assessment.assumptions,
          next_steps: assessment.next_steps,
          critique,
          revised_from_context: data.additionalContext,
        } as never,
        governance_observations: assessment.governance_observations as never,
        missing_info: assessment.missing_info as never,
        citations: assessment.citations as never,
        confidence: assessment.confidence as never,
        art5_banner: assessment.art5_banner as never,
        role_determination: assessment.role_determination,
        risk_tier: assessment.risk_tier,
      })
      .select()
      .single();
    if (aErr) throw new Error(`Save failed: ${aErr.message}`);

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

Be strict: a one-line description is NOT sufficient. A description that says only "we built a chatbot" or "we use AI for hiring" is NOT sufficient. Score 0.7+ only if at least purpose, users/affected persons, domain, and automation level are clear.${UNTRUSTED_INPUT_DIRECTIVE}`;
    const out = await verdaChat({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: wrapUntrustedInput(data.useCase) },
      ],
      temperature: 0,
      json: true,
      max_tokens: 700,
    });
    const parsed = safeJSONParse(out);
    const result = validate(SufficiencySchema, parsed);
    if (!result.ok) {
      console.warn(`[checkSufficiency] invalid LLM output: ${result.reason}`);
      return {
        sufficient: false,
        score: 0,
        coverage: {},
        missing_questions: ["Pre-flight check output failed validation; please add more detail and retry."],
        rationale: "Pre-flight check could not produce a well-formed response.",
      };
    }
    return result.value;
  });