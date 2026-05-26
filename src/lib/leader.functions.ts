import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { verdaChat, safeJSONParse } from "./llm.server";

/**
 * Leader (router) agent.
 * Decides which agent should run next given the current state of the dossier.
 * For now there are two terminal routes:
 *   - "assess"   → enough information; hand off to the assessment council.
 *   - "ask_user" → not enough information; surface follow-up questions to the user.
 *
 * Returned shape is stable so the UI can branch on `next` and render the readiness
 * report when present.
 */
export const leaderRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ useCase: z.string().min(1).max(20000) }).parse(d))
  .handler(async ({ data }) => {
    const sys = `You are the LEADER agent of a multi-agent EU AI Act assessment system. Your sole job is to look at the user's current use-case submission and decide which agent runs next.

Possible next agents:
- "assessment": the council can produce a defensible preliminary opinion now.
- "ask_user":   the submission is too thin; the user should be asked for more detail before the council convenes.

Decide "assessment" only if AT LEAST these are clear:
  • intended purpose
  • who deploys it and who is affected
  • domain / sector
  • automation level (decision-support vs automated decision)

Return STRICT JSON:
{
  "next": "assessment" | "ask_user",
  "readiness_score": number,              // 0..1
  "coverage": {
    "purpose": boolean,
    "users_and_affected": boolean,
    "domain": boolean,
    "inputs_outputs": boolean,
    "automation_and_oversight": boolean,
    "role": boolean,
    "geography": boolean
  },
  "missing_questions": string[],          // 3-6 short concrete follow-ups; [] if next="assessment"
  "rationale": string                     // 1-2 sentences explaining the routing decision
}

Be strict. A one-liner is never enough.`;

    const out = await verdaChat({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: data.useCase },
      ],
      temperature: 0,
      json: true,
      max_tokens: 700,
    });

    type LeaderDecision = {
      next: "assessment" | "ask_user";
      readiness_score: number;
      coverage: Record<string, boolean>;
      missing_questions: string[];
      rationale: string;
    };
    const parsed = safeJSONParse<LeaderDecision>(out);
    return (
      parsed ?? {
        next: "ask_user" as const,
        readiness_score: 0,
        coverage: {},
        missing_questions: ["Leader parser failed — please add more detail and retry."],
        rationale: "Leader could not parse the routing decision.",
      }
    );
  });
