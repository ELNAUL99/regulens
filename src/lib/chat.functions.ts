import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mistralChat, wrapUntrustedInput, UNTRUSTED_INPUT_DIRECTIVE } from "./llm.server";

/** List messages for a session (user must own the session). */
export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Send a follow-up message; returns assistant reply grounded in the session's assessment. */
export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        sessionId: z.string().uuid(),
        content: z.string().min(1).max(4000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify ownership and load context.
    const { data: session, error: sErr } = await supabase
      .from("sessions")
      .select("id, title, user_id, documents(content, filename), assessments(*)")
      .eq("id", data.sessionId)
      .single();
    if (sErr || !session) throw new Error("Session not found");
    if (session.user_id !== userId) throw new Error("Forbidden");

    const assessment = Array.isArray(session.assessments)
      ? session.assessments[0]
      : session.assessments;
    const doc = Array.isArray(session.documents) ? session.documents[0] : session.documents;

    // Load prior chat history.
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: true })
      .limit(40);

    // Persist the user message before the LLM call (so it survives a failure).
    await supabase
      .from("messages")
      .insert({ session_id: data.sessionId, role: "user", content: data.content });

    const assessmentSummary = assessment
      ? JSON.stringify(
          {
            risk_tier: assessment.risk_tier,
            role_determination: assessment.role_determination,
            summary: assessment.summary,
            art5_banner: assessment.art5_banner,
            preliminary_assessment: assessment.preliminary_assessment,
            governance_observations: assessment.governance_observations,
            missing_info: assessment.missing_info,
            citations: assessment.citations,
          },
          null,
          2,
        )
      : "(no assessment available)";

    const sys = `You are the ReguLens council clerk, answering follow-up questions about an EU AI Act (Regulation 2024/1689) assessment that has already been delivered. Be concise, neutral, and grounded.

Rules:
- Ground every legal claim in an Article or Annex point already cited in the assessment, or in the use-case facts. If a question cannot be answered from the existing assessment + use-case, say so and list what additional information would be needed.
- Never invent citations. Refer to articles as "Art. 5", "Art. 50", "Annex III §4", etc.
- Markdown is allowed. Keep responses under ~250 words unless asked to expand.
- This is preliminary triage, not legal advice — remind the user only if they ask for definitive advice.${UNTRUSTED_INPUT_DIRECTIVE}`;

    const userPreamble = `## Original use-case (untrusted user submission)
${wrapUntrustedInput((doc?.content ?? "(missing)").slice(0, 8000))}

## Council assessment (already delivered)
${assessmentSummary}`;

    const messages = [
      { role: "system" as const, content: sys },
      { role: "user" as const, content: userPreamble },
      ...((history ?? []) as { role: "user" | "assistant"; content: string }[]).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user" as const, content: data.content },
    ];

    const reply = await mistralChat({
      messages,
      temperature: 0.2,
      max_tokens: 1200,
    });

    const assistantContent = reply.trim() || "(no response)";
    const { data: saved, error: mErr } = await supabase
      .from("messages")
      .insert({ session_id: data.sessionId, role: "assistant", content: assistantContent })
      .select()
      .single();
    if (mErr) throw new Error(mErr.message);

    return { message: saved };
  });