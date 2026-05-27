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
    human_oversight: z.string().optional(),
    biometric_or_emotion: z.boolean().optional(),
    workplace_or_education: z.boolean().optional(),
    public_authority: z.boolean().optional(),
    publicly_accessible_space: z.boolean().optional(),
    real_time_remote_biometric_id: z.boolean().optional(),
    law_enforcement_context: z.boolean().optional(),
    // Challenge-required additions:
    ai_generated_content: z.boolean().optional(),
    gpai_use: z.boolean().optional(),
    gpai_role: z.enum(["provider", "downstream-deployer", "none", "unknown"]).optional(),
    impact_on_people: z.string().optional(),
    role_hint: z.enum(["provider", "deployer", "both", "unknown"]).optional(),
    missing_info: z.array(z.string()).optional(),
  })
  .passthrough();
export type Facts = z.infer<typeof FactsSchema>;

export const AssessmentSchema = z.object({
  summary: z.string(),
  is_ai_system: z.object({
    // Art. 3(1) definition: machine-based system, inferring from inputs, with
    // some autonomy, possibly adaptive, generating outputs that influence
    // environments. We capture the gate explicitly so the rest of the
    // assessment can short-circuit when the answer is "not an AI system".
    qualifies: z.boolean(),
    rationale: z.string(),
  }),
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
    // Challenge-required additions: documentation / logging / oversight / QMS / post-market / incidents
    technical_documentation_art11: z.string().nullable(),
    record_keeping_art12: z.string().nullable(),
    human_oversight_art14: z.string().nullable(),
    quality_management_art17: z.string().nullable(),
    post_market_monitoring_art72: z.string().nullable(),
    serious_incident_reporting_art73: z.string().nullable(),
  }),
  gpai_obligations: z.object({
    // Dedicated GPAI analysis path. Empty/false when not a GPAI scenario.
    applies: z.boolean(),
    role: z.enum(["provider", "downstream-deployer", "none"]),
    transparency_art53: z.string().nullable(),
    copyright_compliance: z.string().nullable(),
    systemic_risk_art55: z.string().nullable(),
    notes: z.string().nullable(),
  }),
  adjacent_frameworks: z.array(
    z.object({
      // Bonus: flag when GDPR / DSA / sector-specific rules may also apply.
      framework: z.string(),
      relevance: z.string(),
    }),
  ),
  assumptions: z.array(z.string()),
  next_steps: z.array(
    z.object({
      item: z.string(),
      basis: z.string(),
      priority: z.enum(["high", "medium", "low"]),
    }),
  ),
  missing_info: z.array(z.string()),
  citations: z.array(
    z.object({
      tag: z.string(),
      quote: z.string(),
      // Attached server-side by the verifier (one of: regulation / guidance /
      // national / commentary). Optional because the LLM doesn't supply it.
      source_type: z.string().optional(),
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

/** Red-team critique output. The critique agent argues the OPPOSITE risk tier
 *  and either confirms the council's verdict or recommends a revision. */
export const CritiqueSchema = z.object({
  challenged_risk_tier: z.enum(["prohibited", "high", "limited", "minimal", "gpai", "unclear"]),
  steel_man: z.string(),
  weaknesses_found: z.array(z.string()),
  verdict: z.enum(["confirm", "revise"]),
  recommended_risk_tier: z
    .enum(["prohibited", "high", "limited", "minimal", "gpai", "unclear"])
    .nullable(),
  recommended_changes: z.array(z.string()),
});
export type Critique = z.infer<typeof CritiqueSchema>;

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
