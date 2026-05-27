import { AlertTriangle, Download, Printer } from "lucide-react";

type Result = {
  sessionId: string;
  assessmentId: string;
  assessment: Record<string, unknown> | null;
  retrieved: { tag: string; title: string; similarity: number }[];
  verifier_notes: string[];
};

function SectionHead({ part, title }: { part: string; title: string }) {
  return (
    <div className="grid md:grid-cols-12 gap-8 mb-6">
      <div className="md:col-span-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
        {part}
      </div>
      <div className="md:col-span-10">
        <h3 className="font-serif text-3xl leading-tight tracking-tight">{title}</h3>
      </div>
    </div>
  );
}

function SectionBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid md:grid-cols-12 gap-8">
      <div className="hidden md:block md:col-span-2" />
      <div className="md:col-span-10 font-serif text-lg leading-[1.5] text-ink/85">
        {children}
      </div>
    </div>
  );
}

function ConfBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className="h-px w-full mt-3" style={{ background: "var(--rule)" }}>
      <div
        className="h-px"
        style={{ width: `${v * 100}%`, background: "var(--ink)" }}
      />
    </div>
  );
}

const RISK_LABEL: Record<string, string> = {
  prohibited: "Prohibited",
  high: "High-risk",
  limited: "Limited risk",
  minimal: "Minimal risk",
  gpai: "GPAI",
};

export function AssessmentReport({ result }: { result: Result }) {
  const a = (result.assessment ?? {}) as Record<string, unknown>;
  const art5 = (a.art5_banner ?? {}) as {
    triggered?: boolean;
    letter?: string | null;
    rationale?: string;
  };
  const prelim = (a.preliminary_assessment ?? {}) as {
    rationale?: string;
    annex_iii_point?: string | null;
    is_ai_system?: { qualifies?: boolean; rationale?: string };
    gpai_obligations?: {
      applies?: boolean;
      role?: "provider" | "downstream-deployer" | "none";
      transparency_art53?: string | null;
      copyright_compliance?: string | null;
      systemic_risk_art55?: string | null;
      notes?: string | null;
    };
    adjacent_frameworks?: { framework: string; relevance: string }[];
    assumptions?: string[];
    next_steps?: { item: string; basis: string; priority: "high" | "medium" | "low" }[];
    critique?: {
      challenged_risk_tier: string;
      steel_man: string;
      weaknesses_found: string[];
      verdict: "confirm" | "revise";
      recommended_risk_tier: string | null;
      recommended_changes: string[];
    } | null;
  };
  const aiGate = prelim.is_ai_system ?? { qualifies: true, rationale: "" };
  const gpai = prelim.gpai_obligations;
  const adjacent = prelim.adjacent_frameworks ?? [];
  const assumptions = prelim.assumptions ?? [];
  const llmNextSteps = prelim.next_steps ?? [];
  const critique = prelim.critique ?? null;
  const gov = (a.governance_observations ?? {}) as Record<string, unknown>;
  const citations =
    (a.citations as { tag: string; quote: string; source_type?: string }[] | undefined) ?? [];
  const missing = (a.missing_info as string[] | undefined) ?? [];
  const conf = (a.confidence ?? {}) as Record<string, number>;

  const risk = (a.risk_tier as string) ?? "unclear";
  const role = (a.role_determination as string) ?? "unclear";
  const summary = (a.summary as string) ?? "";

  const govRows = [
    gov.transparency_art50 && { k: "Art. 50 transparency", v: String(gov.transparency_art50) },
    gov.deployer_duties_art26 && { k: "Art. 26 deployer duties", v: String(gov.deployer_duties_art26) },
    { k: "Art. 27 FRIA required", v: gov.fria_art27_required ? "Yes" : "No" },
    { k: "Art. 86 right to explanation", v: gov.art86_right_to_explanation ? "Yes" : "No" },
    gov.value_chain_art25 && { k: "Art. 25 value chain", v: String(gov.value_chain_art25) },
    gov.technical_documentation_art11 && {
      k: "Art. 11 technical documentation",
      v: String(gov.technical_documentation_art11),
    },
    gov.record_keeping_art12 && { k: "Art. 12 record-keeping", v: String(gov.record_keeping_art12) },
    gov.human_oversight_art14 && { k: "Art. 14 human oversight", v: String(gov.human_oversight_art14) },
    gov.quality_management_art17 && {
      k: "Art. 17 quality management",
      v: String(gov.quality_management_art17),
    },
    gov.post_market_monitoring_art72 && {
      k: "Art. 72 post-market monitoring",
      v: String(gov.post_market_monitoring_art72),
    },
    gov.serious_incident_reporting_art73 && {
      k: "Art. 73 serious-incident reporting",
      v: String(gov.serious_incident_reporting_art73),
    },
  ].filter(Boolean) as { k: string; v: string }[];

  // ---- Next-steps checklist, derived from the assessment ----
  const checklist: { item: string; why: string }[] = [];
  if (art5.triggered) {
    checklist.push({
      item: "Halt deployment in the EU and consult counsel before any further work",
      why: `Article 5 prohibition${art5.letter ? ` (Art. 5(1)(${art5.letter}))` : ""} appears to apply.`,
    });
  }
  if (risk === "high") {
    checklist.push(
      { item: "Set up an Article 9 risk-management system covering the full lifecycle", why: "Mandatory for high-risk AI systems." },
      { item: "Document data governance and training/validation/test data quality (Art. 10)", why: "Required pre-market evidence." },
      { item: "Prepare technical documentation per Annex IV (Art. 11)", why: "Required for conformity assessment and market surveillance." },
      { item: "Enable automatic event logging over the lifecycle (Art. 12)", why: "Traceability obligation." },
      { item: "Draft transparency / instructions for use for deployers (Art. 13)", why: "Required for high-risk systems." },
      { item: "Design effective human oversight measures (Art. 14)", why: "Mandatory before placing on market." },
      { item: "Validate accuracy, robustness and cybersecurity (Art. 15)", why: "Mandatory pre-market." },
      { item: "Register the system in the EU database before market placement (Art. 49)", why: "Required for Annex III systems." },
    );
  }
  if (risk === "limited") {
    checklist.push({
      item: "Implement Article 50 transparency notices to affected users",
      why: "Limited-risk obligations focus on transparency at point of interaction.",
    });
  }
  if (risk === "gpai") {
    checklist.push(
      { item: "Maintain GPAI technical documentation (Art. 53(1)(a))", why: "Required for GPAI model providers." },
      { item: "Provide downstream-provider documentation (Art. 53(1)(b))", why: "Enables integrators to meet their obligations." },
      { item: "Adopt a Union copyright compliance policy (Art. 53(1)(c))", why: "Including Art. 4(3) DSM Directive opt-outs." },
      { item: "Publish a sufficiently detailed training-data summary (Art. 53(1)(d))", why: "Public transparency obligation." },
    );
  }
  if (gov.fria_art27_required) {
    checklist.push({
      item: "Conduct and document a Fundamental Rights Impact Assessment (Art. 27)",
      why: "Required before first use by qualifying deployers.",
    });
  }
  if (gov.art86_right_to_explanation) {
    checklist.push({
      item: "Set up a process to provide Art. 86 explanations to affected persons",
      why: "Required when decisions produce legal or similarly significant effects.",
    });
  }
  if (gov.transparency_art50) {
    checklist.push({
      item: "Implement Art. 50 transparency / labelling (e.g. AI-interaction notice, AI-generated content marking)",
      why: String(gov.transparency_art50),
    });
  }
  if (gov.deployer_duties_art26) {
    checklist.push({
      item: "Verify Art. 26 deployer duties (instructions for use, human oversight, monitoring, logs)",
      why: String(gov.deployer_duties_art26),
    });
  }
  if (gov.value_chain_art25) {
    checklist.push({
      item: "Clarify Art. 25 value-chain responsibilities with upstream/downstream parties",
      why: String(gov.value_chain_art25),
    });
  }
  // AI literacy applies to everyone using AI in a professional context.
  checklist.push({
    item: "Ensure staff AI literacy measures are in place (Art. 4)",
    why: "Applies to all providers and deployers.",
  });
  for (const m of missing.slice(0, 5)) {
    checklist.push({ item: `Gather missing information: ${m}`, why: "Flagged by the council as needed to firm up the assessment." });
  }
  // Merge in the LLM-generated next_steps (de-duplicate by item text).
  const seen = new Set(checklist.map((c) => c.item.toLowerCase()));
  for (const s of llmNextSteps) {
    if (!seen.has(s.item.toLowerCase())) {
      checklist.push({ item: s.item, why: s.basis });
      seen.add(s.item.toLowerCase());
    }
  }

  function downloadMarkdown() {
    const lines: string[] = [];
    lines.push(`# ReguLens — preliminary opinion`);
    lines.push("");
    lines.push(`- **Opinion ID:** ${result.assessmentId}`);
    lines.push(`- **Risk tier:** ${RISK_LABEL[risk] ?? risk}`);
    lines.push(`- **Role:** ${role}`);
    if (prelim.annex_iii_point) lines.push(`- **Annex III point:** ${prelim.annex_iii_point}`);
    lines.push(`- **Confidence (overall):** ${Math.round((conf.overall ?? 0) * 100)}%`);
    lines.push("");
    if (aiGate.qualifies === false) {
      lines.push(`## Art. 3(1) gate — does not appear to qualify as an AI system`);
      lines.push("");
      lines.push(aiGate.rationale ?? "Fails one or more Article 3(1) criteria.");
      lines.push("");
      lines.push("_The EU AI Act does not apply. The classification below is informational only._");
      lines.push("");
    }
    if (art5.triggered) {
      lines.push(`## Article 5 prohibition${art5.letter ? ` (Art. 5(1)(${art5.letter}))` : ""}`);
      lines.push("");
      lines.push(art5.rationale ?? "");
      lines.push("");
    }
    lines.push(`## 1. Summary`);
    lines.push("");
    lines.push(summary || "_No summary._");
    lines.push("");
    if (prelim.rationale) {
      lines.push(`## 2. Preliminary rationale`);
      lines.push("");
      lines.push(prelim.rationale);
      lines.push("");
    }
    if (govRows.length) {
      lines.push(`## 3. Governance observations`);
      lines.push("");
      for (const g of govRows) lines.push(`- **${g.k}:** ${g.v}`);
      lines.push("");
    }
    if (checklist.length) {
      lines.push(`## 4. Next-steps checklist`);
      lines.push("");
      for (const c of checklist) lines.push(`- [ ] **${c.item}** — _${c.why}_`);
      lines.push("");
    }
    if (missing.length) {
      lines.push(`## 5. Missing information`);
      lines.push("");
      for (const m of missing) lines.push(`- ${m}`);
      lines.push("");
    }
    if (citations.length) {
      lines.push(`## 6. Authorities cited`);
      lines.push("");
      for (const c of citations) {
        const badge = c.source_type ? ` [${c.source_type}]` : "";
        lines.push(`- **${c.tag}**${badge} — "${c.quote}"`);
      }
      lines.push("");
    }
    if (gpai?.applies) {
      lines.push(`## GPAI obligations (${gpai.role})`);
      lines.push("");
      if (gpai.transparency_art53) lines.push(`- **Art. 53 transparency:** ${gpai.transparency_art53}`);
      if (gpai.copyright_compliance) lines.push(`- **Art. 53(1)(c) copyright:** ${gpai.copyright_compliance}`);
      if (gpai.systemic_risk_art55) lines.push(`- **Art. 55 systemic risk:** ${gpai.systemic_risk_art55}`);
      if (gpai.notes) lines.push(`- ${gpai.notes}`);
      lines.push("");
    }
    if (assumptions.length) {
      lines.push(`## Assumptions`);
      lines.push("");
      for (const a of assumptions) lines.push(`- ${a}`);
      lines.push("");
    }
    if (adjacent.length) {
      lines.push(`## Adjacent frameworks (outside the AI Act)`);
      lines.push("");
      for (const fw of adjacent) lines.push(`- **${fw.framework}:** ${fw.relevance}`);
      lines.push("");
    }
    if (critique) {
      lines.push(`## Red-team critique`);
      lines.push("");
      lines.push(
        `**Verdict:** ${critique.verdict}${critique.verdict === "revise" ? ` → ${critique.recommended_risk_tier ?? critique.challenged_risk_tier}` : ""}`,
      );
      lines.push("");
      lines.push(`**Steel-man for ${critique.challenged_risk_tier}:** ${critique.steel_man}`);
      lines.push("");
      if (critique.weaknesses_found.length) {
        lines.push(`**Weaknesses flagged:**`);
        for (const w of critique.weaknesses_found) lines.push(`- ${w}`);
        lines.push("");
      }
      if (critique.recommended_changes.length) {
        lines.push(`**Recommended changes:**`);
        for (const c of critique.recommended_changes) lines.push(`- ${c}`);
        lines.push("");
      }
    }
    if (result.retrieved.length) {
      lines.push(`## 7. Corpus consulted`);
      lines.push("");
      for (const r of result.retrieved) lines.push(`- ${r.tag} — ${r.title} (${(r.similarity * 100).toFixed(0)}%)`);
      lines.push("");
    }
    if (result.verifier_notes.length) {
      lines.push(`## 8. Verifier notes`);
      lines.push("");
      lines.push(result.verifier_notes.join(" "));
      lines.push("");
    }
    lines.push("---");
    lines.push("_This opinion is a preliminary triage, not legal advice. Always validate with qualified counsel._");
    const md = lines.join("\n");
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `regulens-opinion-${result.assessmentId.slice(0, 8)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <article className="font-sans">
      {/* Opinion masthead */}
      <div className="border-t border-b py-3 mb-10" style={{ borderColor: "var(--ink)" }}>
        <div className="flex items-baseline justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60">
          <span>Opinion · entered of record</span>
          <span className="hidden md:inline">Reg. (EU) 2024/1689</span>
          <div className="flex items-baseline gap-4">
            <span>№ {result.assessmentId.slice(0, 8)}</span>
            <button
              type="button"
              onClick={downloadMarkdown}
              className="inline-flex items-center gap-1.5 border px-2.5 py-1 hover:bg-ink hover:text-paper transition-colors"
              style={{ borderColor: "var(--ink)" }}
              aria-label="Download opinion as Markdown"
            >
              <Download className="size-3" strokeWidth={1.5} />
              <span>Export · .md</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 border px-2.5 py-1 hover:bg-ink hover:text-paper transition-colors"
              style={{ borderColor: "var(--ink)" }}
              aria-label="Print or save as PDF"
              title="Use your browser's print dialog → Save as PDF"
            >
              <Printer className="size-3" strokeWidth={1.5} />
              <span>Export · PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Headline + verdicts */}
      <header className="grid md:grid-cols-12 gap-8 mb-12">
        <div className="md:col-span-2">
          <div
            className="font-serif text-[4rem] leading-none"
            style={{ color: "var(--seal)" }}
          >
            §
          </div>
          <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
            Opinion · 01
          </div>
        </div>
        <div className="md:col-span-10">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50 mb-4">
            Preliminary opinion of the council
          </div>
          <h2 className="font-serif text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.98] tracking-[-0.02em]">
            <span className="italic" style={{ color: "var(--seal)" }}>
              {RISK_LABEL[risk] ?? risk}
            </span>
            <span className="text-ink/40"> · </span>
            <span>{role}</span>
            {prelim.annex_iii_point && (
              <>
                <span className="text-ink/40"> · </span>
                <span className="font-serif">{prelim.annex_iii_point}</span>
              </>
            )}
          </h2>
          {summary && (
            <p className="mt-6 font-serif text-xl text-ink/75 leading-snug max-w-3xl">
              {summary}
            </p>
          )}
        </div>
      </header>

      {/* Art. 3(1) gate — "is this an AI system at all?" */}
      {aiGate.qualifies === false && (
        <div
          className="border-t border-b py-6 mb-12 grid md:grid-cols-12 gap-8"
          style={{
            borderColor: "var(--ink)",
            background: "color-mix(in oklab, var(--ink) 4%, transparent)",
          }}
        >
          <div className="md:col-span-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink/70">
            Gate · Art. 3(1)
          </div>
          <div className="md:col-span-10">
            <div className="font-serif text-2xl tracking-tight">
              Does not appear to qualify as an AI system
            </div>
            <p className="mt-2 font-serif text-base text-ink/80 leading-snug">
              {aiGate.rationale || "The system fails one or more Article 3(1) criteria."}
            </p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
              The EU AI Act does not apply. The downstream classification below is therefore informational only.
            </p>
          </div>
        </div>
      )}

      {/* Article 5 banner — bench order */}
      {art5.triggered && (
        <div
          className="border-t border-b py-6 mb-12 grid md:grid-cols-12 gap-8"
          style={{ borderColor: "var(--seal)", background: "color-mix(in oklab, var(--seal) 8%, transparent)" }}
        >
          <div className="md:col-span-2 font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: "var(--seal)" }}>
            Bench order
          </div>
          <div className="md:col-span-10 flex gap-4">
            <AlertTriangle className="size-5 mt-1 shrink-0" style={{ color: "var(--seal)" }} strokeWidth={1.5} />
            <div>
              <div className="font-serif text-2xl tracking-tight" style={{ color: "var(--seal)" }}>
                Article 5 prohibition triggered
                {art5.letter ? ` — Art. 5(1)(${art5.letter})` : ""}
              </div>
              <p className="mt-2 font-serif text-base text-ink/80 leading-snug">{art5.rationale}</p>
            </div>
          </div>
        </div>
      )}

      {/* Confidence ledger */}
      <div
        className="border-y grid grid-cols-3 mb-16"
        style={{ borderColor: "var(--rule)" }}
      >
        {[
          { k: "Risk classification", v: conf.risk_tier ?? 0 },
          { k: "Role determination", v: conf.role_determination ?? 0 },
          { k: "Overall", v: conf.overall ?? 0 },
        ].map((c, i) => (
          <div
            key={c.k}
            className={`py-6 px-6 ${i > 0 ? "border-l" : ""}`}
            style={{ borderColor: "var(--rule)" }}
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60">
              {c.k} · confidence
            </div>
            <div className="mt-3 font-serif text-4xl leading-none tracking-tight">
              {(c.v * 100).toFixed(0)}
              <span className="font-mono text-base text-ink/50">%</span>
            </div>
            <ConfBar value={c.v} />
          </div>
        ))}
      </div>

      {/* I. Preliminary rationale */}
      {prelim.rationale && (
        <section className="border-t pt-10 pb-12" style={{ borderColor: "var(--rule)" }}>
          <SectionHead part="Part I" title="Preliminary rationale" />
          <SectionBody>
            <p className="whitespace-pre-wrap">{prelim.rationale}</p>
          </SectionBody>
        </section>
      )}

      {/* II. Governance observations */}
      {govRows.length > 0 && (
        <section className="border-t pt-10 pb-12" style={{ borderColor: "var(--rule)" }}>
          <SectionHead part="Part II" title="Governance observations" />
          <div className="grid md:grid-cols-12 gap-8">
            <div className="hidden md:block md:col-span-2" />
            <table className="md:col-span-10 w-full font-serif border-t" style={{ borderColor: "var(--rule)" }}>
              <tbody>
                {govRows.map((g, i) => (
                  <tr
                    key={i}
                    className="border-t align-baseline"
                    style={{ borderColor: "var(--rule)" }}
                  >
                    <td
                      className="py-4 pr-6 font-mono text-[11px] uppercase tracking-[0.15em] w-1/3 align-baseline"
                      style={{ color: "var(--seal)" }}
                    >
                      {g.k}
                    </td>
                    <td className="py-4 text-base text-ink/85 leading-snug">{g.v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* II.b Next-steps checklist */}
      {checklist.length > 0 && (
        <section className="border-t pt-10 pb-12" style={{ borderColor: "var(--rule)" }}>
          <SectionHead part="Part II · b" title="Next-steps checklist" />
          <div className="grid md:grid-cols-12 gap-8">
            <div className="hidden md:block md:col-span-2" />
            <ul className="md:col-span-10 border-t" style={{ borderColor: "var(--rule)" }}>
              {checklist.map((c, i) => (
                <li
                  key={i}
                  className="border-t py-4 flex items-start gap-4"
                  style={{ borderColor: "var(--rule)" }}
                >
                  <input
                    type="checkbox"
                    className="mt-1.5 size-4 shrink-0 accent-[var(--seal)]"
                    aria-label={c.item}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-serif text-lg leading-snug text-ink/85">{c.item}</div>
                    <div className="mt-1 font-serif italic text-sm text-ink/55">{c.why}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}


      {/* III. Missing information */}
      {missing.length > 0 && (
        <section className="border-t pt-10 pb-12" style={{ borderColor: "var(--rule)" }}>
          <SectionHead part="Part III" title="Information required of counsel" />
          <div className="grid md:grid-cols-12 gap-8">
            <div className="hidden md:block md:col-span-2" />
            <ol className="md:col-span-10">
              {missing.map((m, i) => (
                <li
                  key={i}
                  className="border-t py-4 flex gap-4 font-serif text-lg text-ink/80 leading-snug"
                  style={{ borderColor: "var(--rule)" }}
                >
                  <span className="font-mono text-[10px] text-ink/40 mt-2 w-6">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{m}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* Red-team critique — dissenting opinion */}
      {critique && (
        <section className="border-t pt-10 pb-12" style={{ borderColor: "var(--rule)" }}>
          <SectionHead
            part="Dissent"
            title={
              critique.verdict === "confirm"
                ? `Red-team challenged ${critique.challenged_risk_tier} — council confirmed`
                : `Red-team recommends revision to ${critique.recommended_risk_tier ?? critique.challenged_risk_tier}`
            }
          />
          <div className="grid md:grid-cols-12 gap-8">
            <div className="hidden md:block md:col-span-2" />
            <div className="md:col-span-10 space-y-4">
              <p
                className="font-serif italic text-lg leading-snug text-ink/85 border-l-2 pl-4"
                style={{ borderColor: "var(--seal)" }}
              >
                {critique.steel_man}
              </p>
              {critique.weaknesses_found.length > 0 && (
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50 mb-2">
                    Weaknesses flagged
                  </div>
                  <ul className="space-y-1 font-serif text-base text-ink/80">
                    {critique.weaknesses_found.map((w, i) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </div>
              )}
              {critique.verdict === "revise" && critique.recommended_changes.length > 0 && (
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50 mb-2">
                    Recommended changes
                  </div>
                  <ul className="space-y-1 font-serif text-base text-ink/80">
                    {critique.recommended_changes.map((c, i) => (
                      <li key={i}>• {c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* GPAI obligations */}
      {gpai?.applies && (
        <section className="border-t pt-10 pb-12" style={{ borderColor: "var(--rule)" }}>
          <SectionHead part="GPAI" title={`General-purpose AI · ${gpai.role}`} />
          <div className="grid md:grid-cols-12 gap-8">
            <div className="hidden md:block md:col-span-2" />
            <div className="md:col-span-10">
              <dl className="grid gap-y-3">
                {gpai.transparency_art53 && (
                  <div className="grid md:grid-cols-12 gap-2 py-2 border-t" style={{ borderColor: "var(--rule)" }}>
                    <dt className="md:col-span-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60">
                      Art. 53 transparency
                    </dt>
                    <dd className="md:col-span-8 font-serif text-base text-ink/85">{gpai.transparency_art53}</dd>
                  </div>
                )}
                {gpai.copyright_compliance && (
                  <div className="grid md:grid-cols-12 gap-2 py-2 border-t" style={{ borderColor: "var(--rule)" }}>
                    <dt className="md:col-span-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60">
                      Art. 53(1)(c) copyright
                    </dt>
                    <dd className="md:col-span-8 font-serif text-base text-ink/85">{gpai.copyright_compliance}</dd>
                  </div>
                )}
                {gpai.systemic_risk_art55 && (
                  <div className="grid md:grid-cols-12 gap-2 py-2 border-t" style={{ borderColor: "var(--rule)" }}>
                    <dt className="md:col-span-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60">
                      Art. 55 systemic risk
                    </dt>
                    <dd className="md:col-span-8 font-serif text-base text-ink/85">{gpai.systemic_risk_art55}</dd>
                  </div>
                )}
                {gpai.notes && (
                  <div className="grid md:grid-cols-12 gap-2 py-2 border-t" style={{ borderColor: "var(--rule)" }}>
                    <dt className="md:col-span-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60">
                      Notes
                    </dt>
                    <dd className="md:col-span-8 font-serif text-base text-ink/85">{gpai.notes}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </section>
      )}

      {/* Assumptions — separated from rationale per challenge requirement */}
      {assumptions.length > 0 && (
        <section className="border-t pt-10 pb-12" style={{ borderColor: "var(--rule)" }}>
          <SectionHead part="Caveats" title="Assumptions the council relied on" />
          <div className="grid md:grid-cols-12 gap-8">
            <div className="hidden md:block md:col-span-2" />
            <div className="md:col-span-10">
              <ul className="space-y-2 font-serif text-base text-ink/80">
                {assumptions.map((a, i) => (
                  <li key={i} className="border-l-2 pl-4" style={{ borderColor: "var(--rule)" }}>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Adjacent frameworks — bonus */}
      {adjacent.length > 0 && (
        <section className="border-t pt-10 pb-12" style={{ borderColor: "var(--rule)" }}>
          <SectionHead part="Bonus" title="Adjacent legal frameworks possibly engaged" />
          <div className="grid md:grid-cols-12 gap-8">
            <div className="hidden md:block md:col-span-2" />
            <div className="md:col-span-10">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50 mb-3">
                Outside the AI Act — flagged for separate review by counsel.
              </p>
              <ul className="space-y-3 font-serif text-base text-ink/85">
                {adjacent.map((fw, i) => (
                  <li key={i}>
                    <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/70 mr-2">
                      {fw.framework}
                    </span>
                    {fw.relevance}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* IV. Citations — table of authorities */}
      <section className="border-t pt-10 pb-12" style={{ borderColor: "var(--rule)" }}>
        <SectionHead part="Part IV" title="Authorities cited" />
        <div className="grid md:grid-cols-12 gap-8">
          <div className="hidden md:block md:col-span-2" />
          <div className="md:col-span-10">
            {citations.length === 0 ? (
              <p className="font-serif italic text-ink/60">No grounded citations.</p>
            ) : (
              <ul className="border-t" style={{ borderColor: "var(--rule)" }}>
                {citations.map((c, i) => (
                  <li
                    key={i}
                    className="border-t py-5 flex gap-6"
                    style={{ borderColor: "var(--rule)" }}
                  >
                    <span className="font-mono text-xs text-ink/40 w-6 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div
                          className="font-mono text-[11px] uppercase tracking-[0.15em]"
                          style={{ color: "var(--seal)" }}
                        >
                          {c.tag}
                        </div>
                        {c.source_type && (
                          <span
                            className="font-mono text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 border"
                            style={{
                              borderColor: "var(--rule)",
                              color: "var(--ink)",
                              opacity: 0.65,
                            }}
                            title={`Source type: ${c.source_type}`}
                          >
                            {c.source_type === "regulation"
                              ? "Legislation"
                              : c.source_type === "guidance"
                                ? "Guidance"
                                : c.source_type === "national"
                                  ? "National"
                                  : c.source_type === "commentary"
                                    ? "Commentary"
                                    : c.source_type}
                          </span>
                        )}
                      </div>
                      <blockquote
                        className="mt-2 font-serif italic text-lg leading-snug text-ink/85 border-l-2 pl-4"
                        style={{ borderColor: "var(--seal)" }}
                      >
                        “{c.quote}”
                      </blockquote>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* V. Retrieved corpus */}
      {result.retrieved.length > 0 && (
        <section className="border-t pt-10 pb-12" style={{ borderColor: "var(--rule)" }}>
          <SectionHead part="Part V" title="Corpus consulted" />
          <div className="grid md:grid-cols-12 gap-8">
            <div className="hidden md:block md:col-span-2" />
            <div className="md:col-span-10 flex flex-wrap gap-x-6 gap-y-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ink/60">
              {result.retrieved.map((r, i) => (
                <span
                  key={i}
                  title={`${r.title} — ${(r.similarity * 100).toFixed(0)}%`}
                  className="inline-flex items-baseline gap-2"
                >
                  <span style={{ color: "var(--seal)" }}>{r.tag}</span>
                  <span className="text-ink/40">{(r.similarity * 100).toFixed(0)}%</span>
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* VI. Verifier */}
      {result.verifier_notes.length > 0 && (
        <section className="border-t pt-10 pb-12" style={{ borderColor: "var(--rule)" }}>
          <SectionHead part="Part VI" title="Notes of the verifier" />
          <SectionBody>
            <p className="italic text-ink/75">{result.verifier_notes.join(" ")}</p>
          </SectionBody>
        </section>
      )}

      {/* Disclaimer */}
      <div
        className="border-t mt-8 pt-6 font-serif italic text-sm text-ink/50 text-center"
        style={{ borderColor: "var(--rule)" }}
      >
        This opinion is a preliminary triage, not legal advice.
        Always validate with qualified counsel.
      </div>
    </article>
  );
}