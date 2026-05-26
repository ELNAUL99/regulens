// Zod schemas for LLM-produced JSON. Every LLM output that we persist or branch
// on must round-trip through one of these before the rest of the pipeline sees
// it — otherwise a malformed response (or a successful prompt-injection) can
// poison the DB or the UI.
import { z } from "zod";

const RiskTier = z.enum(["prohibited", "high", "limited", "minimal", "gpai", "unclear"]);
const Role = z.enum(["provider", "deployer", "both", "unclear"]);

export const FactsSchema = z
  .object({
    purpose: z.string().optional(),
    modality: z.string().optional(),
    domain: z.string().optional(),
    deployment_context: z.string().optional(),
    data_subjects: z.string().optional(),
    decision_stakes: z.enum(["low", "medium", "high"]).optional(),
    automation_level: z.enum(["decision-support", "automated-decision"]).optional(),
    biometric_or_emotion: z.boolean().optional(),
    workplace_or_education: z.boolean().optional(),
    public_authority: z.boolean().optional(),
    publicly_accessible_space: z.boolean().optional(),
    real_time_remote_biometric_id: z.boolean().optional(),
    law_enforcement_context: z.boolean().optional(),
    role_hint: z.enum(["provider", "deployer", "both", "unknown"]).optional(),
    missing_info: z.array(z.string()).optional(),
  })
  .passthrough();
export type Facts = z.infer<typeof FactsSchema>;

export const AssessmentSchema = z.object({
  summary: z.string(),
  role_determination: Role,
  risk_tier: RiskTier,
  art5_banner: z.object({
    triggered: z.boolean(),
    letter: z.string().nullable(),
    rationale: z.string(),
  }),
  preliminary_assessment: z.object({
    rationale: z.string(),
    annex_iii_point: z.string().nullable(),
  }),
  governance_observations: z.object({
    transparency_art50: z.string().nullable(),
    deployer_duties_art26: z.string().nullable(),
    fria_art27_required: z.boolean(),
    art86_right_to_explanation: z.boolean(),
    value_chain_art25: z.string().nullable(),
  }),
  missing_info: z.array(z.string()),
  citations: z.array(
    z.object({
      tag: z.string(),
      quote: z.string(),
    }),
  ),
  confidence: z.object({
    risk_tier: z.number(),
    role_determination: z.number(),
    overall: z.number(),
  }),
});
export type Assessment = z.infer<typeof AssessmentSchema>;

export const LeaderDecisionSchema = z.object({
  next: z.enum(["assessment", "ask_user"]),
  readiness_score: z.number(),
  coverage: z.record(z.string(), z.boolean()),
  missing_questions: z.array(z.string()),
  rationale: z.string(),
});
export type LeaderDecision = z.infer<typeof LeaderDecisionSchema>;

export const SufficiencySchema = z.object({
  sufficient: z.boolean(),
  score: z.number(),
  coverage: z.record(z.string(), z.boolean()),
  missing_questions: z.array(z.string()),
  rationale: z.string(),
});
export type Sufficiency = z.infer<typeof SufficiencySchema>;

/**
 * Parse + validate. On failure, return null and a short reason. Use the reason
 * for logging or surfacing to the user — never persist the raw string.
 */
export function validate<T>(
  schema: z.ZodType<T>,
  parsed: unknown,
): { ok: true; value: T } | { ok: false; reason: string } {
  const result = schema.safeParse(parsed);
  if (result.success) return { ok: true, value: result.data };
  const reason = result.error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
    .join("; ");
  return { ok: false, reason };
}
