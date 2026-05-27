import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Search,
  Library,
  ScrollText,
  AlertTriangle,
  BookOpen,
  Upload,
  GitBranch,
  FileCheck,
} from "lucide-react";
import { Play, Trash2, Paperclip, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  runAssessment,
  listSessions,
  getSession,
  deleteSession,
  clearSessions,
} from "@/lib/assessment.functions";
import { leaderRoute } from "@/lib/leader.functions";
import { seedCorpus, corpusStatus } from "@/lib/corpus.functions";
import { AssessmentReport } from "@/components/assessment-report";
import { FollowUpChat } from "@/components/follow-up-chat";

import {
  ACCEPT_ATTR,
  MAX_FILE_BYTES,
  extractFileText,
  isAcceptedFile,
  warmPdfTextExtraction,
} from "@/lib/extract-files";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "ReguLens — EU AI Act compliance triage" },
      {
        name: "description",
        content:
          "Multi-agent assessment of AI use-cases against the EU AI Act 2024/1689, with grounded citations.",
      },
    ],
  }),
});

function Home() {
  const [session, setSession] =
    useState<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<"landing" | "dashboard">("dashboard");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (authLoading) return null;
  if (!session) return <Landing />;
  return view === "landing" ? (
    <Landing onEnterApp={() => setView("dashboard")} signedIn />
  ) : (
    <Dashboard onViewLanding={() => setView("landing")} />
  );
}

function Landing({ onEnterApp, signedIn }: { onEnterApp?: () => void; signedIn?: boolean } = {}) {
  const agents = [
    {
      n: "00",
      icon: GitBranch,
      title: "Leader",
      tag: "Routes the case · readiness gate",
      body: "Reads the submission first and decides what should happen next: convene the full council, or send the case back to you with the specific questions still missing. You can always override and convene anyway — the leader's verdict is advice, not a lock.",
    },
    {
      n: "01",
      icon: FileText,
      title: "Document Intake",
      tag: "Classifies + chunks uploaded material",
      body: "Decides whether the upload is a technical spec, vendor whitepaper, policy doc, or process note. Tags every chunk with the source type and stores it in a session-scoped namespace, separate from the regulatory corpus.",
    },
    {
      n: "02",
      icon: Search,
      title: "Fact Extraction",
      tag: "Structured extraction with explicit uncertainty",
      body: "Pulls purpose, users, affected persons, sector, input data, outputs, automation level, human oversight, GPAI usage, and AI-generated content. Flags ambiguities as uncertainties instead of silently resolving them.",
    },
    {
      n: "03",
      icon: Library,
      title: "Regulatory Retrieval",
      tag: "Selects relevant corpus chunks",
      body: "Given the extracted facts, decides which parts of the AI Act, Commission guidelines, GPAI Code of Practice, and national implementation material are relevant — labelling every chunk with its source type.",
    },
    {
      n: "04",
      icon: ScrollText,
      title: "Assessment",
      tag: "Definition · risk · prohibited · transparency · GPAI · role",
      body: "Produces the preliminary AI Act assessment: AI system definition check, risk classification (Annex III), prohibited practice screen, transparency obligations, GPAI obligations, and provider vs deployer role. Every claim is grounded in a cited article.",
    },
    {
      n: "05",
      icon: AlertTriangle,
      title: "Critique",
      tag: "Catches weak evidence, triggers revisions",
      body: "Asks whether each conclusion is supported by the uploaded docs or merely assumed. Sends the assessment back with specific revision instructions when evidence is weak, and writes the missing-info list and follow-up questions.",
    },
    {
      n: "06",
      icon: BookOpen,
      title: "Report Composer",
      tag: "Six-section report, fact/assumption/citation separated",
      body: "Assembles the six required output sections, enforces fact/assumption/citation separation, adds the not-legal-advice disclaimer, and produces the export-ready report.",
    },
  ];

  const steps = [
    {
      n: "01",
      icon: Upload,
      title: "File the use-case",
      body: "Paste a description or attach a spec. The Leader agent reads it first and decides whether there's enough to proceed, or which questions you should answer before convening the council.",
    },
    {
      n: "02",
      icon: GitBranch,
      title: "Council deliberates",
      body: "Once routed forward, six agents run in sequence: intake → facts → retrieval → assessment → critique → report. Critique can send the assessment back for revision when the evidence is thin.",
    },
    {
      n: "03",
      icon: FileCheck,
      title: "Cited opinion + follow-up",
      body: "A six-section report with facts, assumptions and citations kept separate. Every conclusion traces to an Article. Ask follow-up questions in the chat — answers stay grounded in the same corpus.",
    },
  ];


  const corpus = [
    { title: "Definition of an AI system", ref: "EU AI Act, Article 3(1)" },
    { title: "Prohibited AI practices", ref: "EU AI Act, Article 5" },
    { title: "High-risk AI systems (Annex III)", ref: "EU AI Act, Annex III" },
    { title: "Classification rules for high-risk AI systems", ref: "EU AI Act, Article 6" },
    { title: "Transparency obligations", ref: "EU AI Act, Article 50" },
    {
      title: "Obligations for providers of general-purpose AI models",
      ref: "EU AI Act, Article 53",
    },
  ];

  return (
    <div
      className="min-h-screen font-sans"
      style={{
        background: "var(--paper)",
        color: "var(--ink)",
      }}
    >
      {/* Top metadata strip — like a journal masthead */}
      <div
        className="border-b font-mono text-[10px] uppercase tracking-[0.2em]"
        style={{ borderColor: "var(--rule)" }}
      >
        <div className="container mx-auto px-8 py-2.5 flex justify-between items-center text-ink/60">
          <span>Regulation (EU) 2024/1689 · Working Edition</span>
          <span className="hidden md:inline">Vol. I · Folio 001</span>
          <span>Bruxelles · MMXXVI</span>
        </div>
      </div>

      {/* Masthead */}
      <header>
        <div className="container mx-auto px-8 py-6 flex justify-between items-center">
          <Link to="/" className="flex items-baseline gap-3">
            <span className="font-serif text-3xl leading-none tracking-tight">ReguLens</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
              Est. MMXXVI
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-10 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60">
            <a href="#pipeline" className="hover:text-ink transition-colors">
              § I · Pipeline
            </a>
            <a href="#how-it-works" className="hover:text-ink transition-colors">
              § II · Procedure
            </a>
            <a href="#corpus" className="hover:text-ink transition-colors">
              § III · Corpus
            </a>
          </nav>
          <div className="flex items-center gap-3">
            {signedIn ? (
              <button
                onClick={onEnterApp}
                className="font-mono text-[11px] uppercase tracking-[0.2em] border px-4 py-2.5 hover:bg-ink hover:text-paper transition-colors"
                style={{ borderColor: "var(--ink)" }}
              >
                Open dossier →
              </button>
            ) : (
              <Link
                to="/login"
                className="font-mono text-[11px] uppercase tracking-[0.2em] border px-4 py-2.5 hover:bg-ink hover:text-paper transition-colors"
                style={{ borderColor: "var(--ink)" }}
              >
                File a use-case →
              </Link>
            )}
            <ThemeToggle />
          </div>
        </div>
        <div className="border-b" style={{ borderColor: "var(--rule)" }} />
        <div className="border-b mt-px" style={{ borderColor: "var(--rule)" }} />
      </header>

      {/* HERO — editorial cover */}
      <section className="container mx-auto px-8 pt-20 pb-24">
        <div className="grid md:grid-cols-12 gap-8 items-end">
          <div className="md:col-span-2">
            <div className="font-serif text-[5rem] leading-none" style={{ color: "var(--seal)" }}>
              §
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50 mt-2">
              No. 01 — Folio
            </div>
          </div>
          <div className="md:col-span-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/50 mb-6">
              A leader agent and a six-agent council on the AI Act
            </div>
            <h1 className="font-serif text-[clamp(3.5rem,8vw,7.5rem)] leading-[0.94] tracking-[-0.02em]">
              Preliminary
              <br />
              <span className="italic" style={{ color: "var(--seal)" }}>
                assessments
              </span>{" "}
              of AI
              <br />
              systems, cited
              <br />
              to the article.
            </h1>
          </div>
        </div>

        {/* Lede / standfirst — two-column print body */}
        <div className="mt-20 grid md:grid-cols-12 gap-8">
          <div className="md:col-span-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
            Abstract
          </div>
          <div className="md:col-span-7 font-serif text-2xl md:text-[1.7rem] leading-[1.35] text-ink/90">
            Submit a technical specification, a vendor whitepaper, or a single paragraph of intent.
            A leader agent decides whether the case is ready or sends back the specific questions
            you should answer first. Once routed forward, six specialised agents extract facts,
            retrieve the governing articles, deliberate, audit their own citations, and return a
            six-section opinion —{" "}
            <span className="italic" style={{ color: "var(--seal)" }}>
              every claim traceable to its source.
            </span>
          </div>
          <div className="md:col-span-3 flex flex-col gap-3 self-end">
            {signedIn ? (
              <button
                onClick={onEnterApp}
                className="font-mono text-[11px] uppercase tracking-[0.2em] py-3.5 px-5 text-paper transition-opacity hover:opacity-90"
                style={{ background: "var(--ink)" }}
              >
                Open the dossier →
              </button>
            ) : (
              <Link
                to="/login"
                className="font-mono text-[11px] uppercase tracking-[0.2em] py-3.5 px-5 text-paper text-center transition-opacity hover:opacity-90"
                style={{ background: "var(--ink)" }}
              >
                Begin an assessment →
              </Link>
            )}
            <a
              href="#pipeline"
              className="font-mono text-[11px] uppercase tracking-[0.2em] py-3.5 px-5 border text-center hover:bg-ink/5 transition-colors"
              style={{ borderColor: "var(--ink)" }}
            >
              Read the procedure
            </a>
          </div>
        </div>

        {/* Numerical colophon */}
        <div
          className="mt-24 border-y grid grid-cols-2 md:grid-cols-4"
          style={{ borderColor: "var(--rule)" }}
        >
          {[
            { k: "1 + VI", v: "Leader + council", note: "Routing · then deliberation" },
            { k: "MMXXIV", v: "Regulation of record", note: "EU 2024/1689" },
            { k: "≤ 02:00", v: "Per opinion", note: "Median deliberation" },
            { k: "100%", v: "Cited claims", note: "No silent inference" },
          ].map((s, i) => (
            <div
              key={s.v}
              className={`py-8 px-6 ${i > 0 ? "md:border-l" : ""} ${i > 1 ? "border-t md:border-t-0" : ""}`}
              style={{ borderColor: "var(--rule)" }}
            >
              <div className="font-serif text-5xl leading-none tracking-tight">{s.k}</div>
              <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60">
                {s.v}
              </div>
              <div className="mt-1 font-serif italic text-sm text-ink/50">{s.note}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PIPELINE — Articles I through VI */}
      <section id="pipeline" className="border-t" style={{ borderColor: "var(--rule)" }}>
        <div className="container mx-auto px-8 py-24">
          <div className="grid md:grid-cols-12 gap-8 mb-16">
            <div className="md:col-span-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
              Part I
            </div>
            <div className="md:col-span-10">
              <h2 className="font-serif text-5xl md:text-6xl leading-[1.02] tracking-tight">
                One leader, six agents,
                <br />
                <span className="italic" style={{ color: "var(--seal)" }}>
                  one continuous record.
                </span>
              </h2>
              <p className="mt-6 font-serif text-xl text-ink/70 max-w-2xl leading-snug">
                A leader agent decides whether a case is ready to convene. Then every handoff
                between the six council agents is inspectable — no monolithic prompt, no
                black-box reasoning, each agent answers to the trail the previous one left.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3">
            {agents.map((a, i) => (
              <article
                key={a.n}
                className={`p-8 border-t ${i % 3 !== 0 ? "md:border-l" : ""} ${i < 3 ? "md:border-t-0" : ""}`}
                style={{ borderColor: "var(--rule)" }}
              >
                <div className="flex items-baseline justify-between mb-6">
                  <span
                    className="font-serif text-[2.75rem] leading-none tracking-tight"
                    style={{ color: "var(--seal)" }}
                  >
                    {a.n}
                  </span>
                  <a.icon className="size-4 text-ink/40" strokeWidth={1.25} />
                </div>
                <h3 className="font-serif text-2xl leading-tight tracking-tight">{a.title}</h3>
                <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">
                  {a.tag}
                </div>
                <p className="mt-5 text-sm leading-relaxed text-ink/70">{a.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* PROCEDURE — three movements */}
      <section id="how-it-works" className="border-t" style={{ borderColor: "var(--rule)" }}>
        <div className="container mx-auto px-8 py-24">
          <div className="grid md:grid-cols-12 gap-8 mb-16">
            <div className="md:col-span-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
              Part II
            </div>
            <div className="md:col-span-10">
              <h2 className="font-serif text-5xl md:text-6xl leading-[1.02] tracking-tight">
                The procedure,
                <br />
                <span className="italic" style={{ color: "var(--seal)" }}>
                  in three movements.
                </span>
              </h2>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-px" style={{ background: "var(--rule)" }}>
            {steps.map((s) => (
              <div key={s.n} className="p-10" style={{ background: "var(--paper)" }}>
                <div
                  className="font-serif text-[4.5rem] leading-none mb-6 tracking-tight"
                  style={{ color: "var(--seal)" }}
                >
                  {s.n}
                </div>
                <s.icon className="size-5 text-ink/50 mb-4" strokeWidth={1.25} />
                <h3 className="font-serif text-3xl leading-tight tracking-tight mb-3">{s.title}</h3>
                <p className="text-sm leading-relaxed text-ink/70">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CORPUS — like a table of authorities */}
      <section id="corpus" className="border-t" style={{ borderColor: "var(--rule)" }}>
        <div className="container mx-auto px-8 py-24">
          <div className="grid md:grid-cols-12 gap-8 mb-16">
            <div className="md:col-span-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
              Part III
            </div>
            <div className="md:col-span-10">
              <h2 className="font-serif text-5xl md:text-6xl leading-[1.02] tracking-tight">
                Authorities of record,
                <br />
                <span className="italic" style={{ color: "var(--seal)" }}>
                  pre-indexed and inviolate.
                </span>
              </h2>
              <p className="mt-6 font-serif text-xl text-ink/70 max-w-2xl leading-snug">
                The corpus is loaded at boot and lives in a namespace separate from any submission,
                so every citation is traceable to its source type — legislation, official guidance,
                or national implementation.
              </p>
            </div>
          </div>

          <table className="w-full font-serif border-t" style={{ borderColor: "var(--rule)" }}>
            <thead>
              <tr className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50 text-left">
                <th className="py-3 w-12">№</th>
                <th className="py-3">Title</th>
                <th className="py-3 text-right hidden md:table-cell">Authority</th>
                <th className="py-3 text-right w-32">Reference</th>
              </tr>
            </thead>
            <tbody>
              {corpus.map((c, i) => (
                <tr
                  key={c.title}
                  className="border-t align-baseline"
                  style={{ borderColor: "var(--rule)" }}
                >
                  <td className="py-5 font-mono text-xs text-ink/40">
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td className="py-5 text-lg">{c.title}</td>
                  <td className="py-5 italic text-sm text-ink/50 text-right hidden md:table-cell">
                    Legislation
                  </td>
                  <td
                    className="py-5 font-mono text-[11px] uppercase tracking-[0.15em] text-right"
                    style={{ color: "var(--seal)" }}
                  >
                    {c.ref.replace("EU AI Act, ", "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* CTA — Bench order */}
      <section
        className="border-t"
        style={{ borderColor: "var(--rule)", background: "var(--ink)", color: "var(--paper)" }}
      >
        <div className="container mx-auto px-8 py-28">
          <div className="grid md:grid-cols-12 gap-8 items-end">
            <div className="md:col-span-2 font-mono text-[10px] uppercase tracking-[0.25em] opacity-60">
              Order
            </div>
            <div className="md:col-span-7">
              <h3 className="font-serif text-5xl md:text-6xl leading-[1.02] tracking-tight">
                File a use-case.
                <br />
                <span className="italic opacity-70">Receive an opinion.</span>
              </h3>
            </div>
            <div className="md:col-span-3 self-end">
              {signedIn ? (
                <button
                  onClick={onEnterApp}
                  className="w-full font-mono text-[11px] uppercase tracking-[0.2em] py-4 px-5 transition-opacity hover:opacity-90"
                  style={{ background: "var(--seal)", color: "var(--paper)" }}
                >
                  Open the dossier →
                </button>
              ) : (
                <Link
                  to="/login"
                  className="block w-full font-mono text-[11px] uppercase tracking-[0.2em] py-4 px-5 text-center transition-opacity hover:opacity-90"
                  style={{ background: "var(--seal)", color: "var(--paper)" }}
                >
                  Begin an assessment →
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Colophon */}
      <footer className="border-t" style={{ borderColor: "var(--rule)" }}>
        <div className="container mx-auto px-8 py-10 grid md:grid-cols-12 gap-8 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
          <div className="md:col-span-4">
            <div className="font-serif italic text-lg normal-case tracking-normal text-ink mb-1">
              Colophon
            </div>
            ReguLens · MMXXVI · AI For Good Hackathon
          </div>
          <div className="md:col-span-5 normal-case tracking-normal font-serif text-sm italic text-ink/60">
            This publication is informational only and does not constitute legal advice. Findings
            must be reviewed by qualified counsel before any decision of record.
          </div>
          <div className="md:col-span-3 md:text-right">
            Set in Instrument Serif &<br />
            JetBrains Mono · Inter
          </div>
        </div>
      </footer>
    </div>
  );
}

const PIPELINE_AGENTS = [
  {
    n: "00",
    icon: GitBranch,
    title: "Leader",
    tag: "Routes the case · readiness gate",
  },
  {
    n: "01",
    icon: FileText,
    title: "Document Intake",
    tag: "Classifies + chunks uploaded material",
  },
  {
    n: "02",
    icon: Search,
    title: "Fact Extraction",
    tag: "Structured extraction with explicit uncertainty",
  },
  { n: "03", icon: Library, title: "Regulatory Retrieval", tag: "Selects relevant corpus chunks" },
  {
    n: "04",
    icon: ScrollText,
    title: "Assessment",
    tag: "Definition · risk · prohibited · transparency · …",
  },
  {
    n: "05",
    icon: AlertTriangle,
    title: "Critique",
    tag: "Catches weak evidence, triggers revisions",
  },
  {
    n: "06",
    icon: BookOpen,
    title: "Report Composer",
    tag: "Six-section report, fact/assumption/citation separated",
  },
];

const SAMPLE_USE_CASE =
  "We are building HireSift, an LLM-powered tool that ranks incoming CVs for corporate HR teams across the EU. The tool ingests the job description and a batch of applications, extracts skills, education and experience, and returns a ranked shortlist with a one-line rationale per candidate. A human recruiter reviews the shortlist before any interview decision is made. No biometric data is processed. The provider is a UK SaaS company; deployers are EU-based employers.";

const ASSESSMENT_INPUT_LIMIT = 20_000;

function Dashboard({ onViewLanding }: { onViewLanding?: () => void } = {}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [useCase, setUseCase] = useState("");
  const [currentResult, setCurrentResult] = useState<Awaited<
    ReturnType<typeof runAssessment>
  > | null>(null);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<
    { id: string; name: string; size: number; text: string }[]
  >([]);
  const [extracting, setExtracting] = useState(false);
  const [extractingFile, setExtractingFile] = useState<string | null>(null);
  const [extractProgress, setExtractProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [leaderDecision, setLeaderDecision] = useState<{
    next: "assessment" | "ask_user";
    readiness_score: number;
    coverage: Record<string, boolean>;
    missing_questions: string[];
    rationale: string;
  } | null>(null);
  const [leaderAnswers, setLeaderAnswers] = useState<Record<number, string>>({});

  const runFn = useServerFn(runAssessment);
  const listFn = useServerFn(listSessions);
  const seedFn = useServerFn(seedCorpus);
  const statusFn = useServerFn(corpusStatus);
  const getSessionFn = useServerFn(getSession);
  const deleteSessionFn = useServerFn(deleteSession);
  const clearSessionsFn = useServerFn(clearSessions);
  const leaderFn = useServerFn(leaderRoute);


  const status = useQuery({ queryKey: ["corpus-status"], queryFn: () => statusFn() });
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => listFn() });

  const runMut = useMutation({
    mutationFn: (vars: { useCase: string; title?: string }) => runFn({ data: vars }),
    onSuccess: (res) => {
      setCurrentResult(res);
      // KEEP leaderDecision so the report can show what the leader checked, the
      // readiness score, the coverage breakdown, and any noted gaps — even
      // when the leader auto-routed straight to the council.
      setLeaderAnswers({});
      // Reset the submission form so the user lands on a fresh slate (placeholders
      // visible again) ready for the next assessment.
      setTitle("");
      setUseCase("");
      setAttachments([]);
      qc.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Assessment complete");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Assessment failed"),
  });

  const leaderMut = useMutation({
    mutationFn: (vars: { useCase: string; title?: string }) => leaderFn({ data: { useCase: vars.useCase } }),
    // Never auto-route to the council. Always surface the leader's checks
    // (coverage + any noted gaps) and let the user explicitly convene — even
    // when the leader thinks the input is complete. This is especially
    // important for file-only submissions where the leader may still notice
    // gaps the user could quickly fill in before the council runs.
    onSuccess: (decision) => {
      setLeaderDecision(decision);
      setLeaderAnswers({});
      if (decision.next === "assessment") {
        toast.message("Leader: input is complete enough", {
          description:
            (decision.missing_questions?.length ?? 0) > 0
              ? "Council can convene. You may also answer the noted follow-ups for a stronger assessment."
              : "Council can convene whenever you're ready.",
        });
      } else {
        toast.message("Leader: more detail recommended", {
          description: "Answer the questions below, or convene anyway.",
        });
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Leader routing failed"),
  });

  const seedMut = useMutation({
    mutationFn: () => seedFn(),
    onSuccess: (r) => {
      toast.success(`Seeded ${r.chunks} corpus chunks and ${r.tests} tests`);
      qc.invalidateQueries({ queryKey: ["corpus-status"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Seed failed"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteSessionFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Session deleted");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed"),
  });

  const clearMut = useMutation({
    mutationFn: () => clearSessionsFn(),
    onSuccess: (r) => {
      setCurrentResult(null);
      qc.invalidateQueries({ queryKey: ["sessions"] });
      toast.success(`Cleared ${r.deleted} session${r.deleted === 1 ? "" : "s"}`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Clear failed"),
  });

  useEffect(() => {
    warmPdfTextExtraction();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setExtracting(true);
    setExtractProgress({ done: 0, total: files.length });
    const valid: { id: string; name: string; size: number; text: string }[] = [];
    try {
      // Process one at a time so the UI can show which file is being read and the
      // pdfjs worker isn't overloaded with concurrent requests.
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setExtractingFile(file.name);
        setExtractProgress({ done: i, total: files.length });

        if (!isAcceptedFile(file)) {
          toast.error(`${file.name}: unsupported type. Use PDF, Word or Markdown.`);
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          toast.error(`${file.name}: exceeds 10 MB limit.`);
          continue;
        }
        try {
          const text = (await extractFileText(file)).trim();
          if (!text) {
            const isPdf = file.name.toLowerCase().endsWith(".pdf");
            toast.error(
              `${file.name}: no text extracted.${
                isPdf ? " Scanned PDFs need OCR — paste the text directly instead." : ""
              }`,
            );
            continue;
          }
          valid.push({
            id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
            name: file.name,
            size: file.size,
            text,
          });
        } catch (err) {
          toast.error(`${file.name}: ${err instanceof Error ? err.message : "failed to read"}`);
        }
      }
      if (valid.length) {
        setAttachments((prev) => [...prev, ...valid]);
        toast.success(`Attached ${valid.length} file${valid.length === 1 ? "" : "s"}`);
      }
    } finally {
      setExtracting(false);
      setExtractingFile(null);
      setExtractProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function buildRawSubmission() {
    const attachedText = attachments
      .map((a) => `\n\n--- Attached file: ${a.name} ---\n${a.text}`)
      .join("");
    return (useCase + attachedText).trim();
  }

  function buildSubmission() {
    return buildRawSubmission().slice(0, ASSESSMENT_INPUT_LIMIT);
  }

  const submissionLength = buildSubmission().length;
  const hasTrimmedSubmission = buildRawSubmission().length > ASSESSMENT_INPUT_LIMIT;

  async function openSession(id: string) {
    setLoadingSessionId(id);
    try {
      const s = await getSessionFn({ data: { id } });
      // Pick the most recent assessment so "Revise opinion" surfaces the new one.
      const all = Array.isArray(s.assessments) ? s.assessments : s.assessments ? [s.assessments] : [];
      const sorted = [...all].sort(
        (a, b) =>
          new Date((b as { created_at?: string }).created_at ?? 0).getTime() -
          new Date((a as { created_at?: string }).created_at ?? 0).getTime(),
      );
      const assessment = sorted[0] ?? null;
      if (!assessment) {
        toast.error("No assessment found for this session");
        return;
      }
      setCurrentResult({
        sessionId: s.id,
        assessmentId: assessment.id,
        assessment: assessment as never,
        retrieved: [],
        verifier_notes: [],
      });
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load session");
    } finally {
      setLoadingSessionId(null);
    }
  }

  const corpusReady = (status.data?.count ?? 0) > 0;

  return (
    <div
      className="min-h-screen font-sans"
      style={{ background: "var(--paper)", color: "var(--ink)" }}
    >
      <Toaster />

      {/* Top metadata strip */}
      <div
        className="border-b font-mono text-[10px] uppercase tracking-[0.2em]"
        style={{ borderColor: "var(--rule)" }}
      >
        <div className="container mx-auto px-8 py-2.5 flex justify-between items-center text-ink/60">
          <span>Regulation (EU) 2024/1689 · Working Edition</span>
          <span className="hidden md:inline">
            Corpus: {status.isLoading ? "…" : `${status.data?.count ?? 0} chunks indexed`}
          </span>
          <span>Dossier · Open</span>
        </div>
      </div>

      {/* Masthead */}
      <header>
        <div className="container mx-auto px-8 py-6 flex justify-between items-center">
          <button
            onClick={onViewLanding}
            className="flex items-baseline gap-3 hover:opacity-70 transition-opacity"
          >
            <span className="font-serif text-3xl leading-none tracking-tight">ReguLens</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
              Folio · Working
            </span>
          </button>
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-10 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60">
              {onViewLanding && (
                <button onClick={onViewLanding} className="hover:text-ink transition-colors">
                  ← Overview
                </button>
              )}
              <button
                onClick={() => seedMut.mutate()}
                disabled={seedMut.isPending}
                className="hover:text-ink transition-colors disabled:opacity-50"
              >
                {seedMut.isPending ? "Seeding…" : corpusReady ? "Re-seed corpus" : "Seed corpus"}
              </button>
              <button onClick={signOut} className="hover:text-ink transition-colors">
                Sign out
              </button>
            </nav>
            <ThemeToggle />
          </div>
        </div>
        <div className="border-b" style={{ borderColor: "var(--rule)" }} />
        <div className="border-b mt-px" style={{ borderColor: "var(--rule)" }} />
      </header>

      <main className="container mx-auto px-8 py-16">
        {/* Hero */}
        <div className="grid md:grid-cols-12 gap-8 mb-16">
          <div className="md:col-span-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
            Filing · 01
          </div>
          <div className="md:col-span-10">
            <h1 className="font-serif text-5xl md:text-6xl leading-[1.02] tracking-tight">
              File a use-case for{" "}
              <span className="italic" style={{ color: "var(--seal)" }}>
                preliminary opinion.
              </span>
            </h1>
            <p className="mt-5 font-serif text-xl text-ink/70 max-w-2xl leading-snug">
              Paste a description or attach material. The council will return a cited six-section
              report.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_300px] gap-12 items-start">
          {/* Left: form as ruled ledger */}
          <section>
            <div className="border-t border-b" style={{ borderColor: "var(--ink)" }}>
              <div className="flex items-baseline justify-between py-3 px-1">
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60">
                  Form B · Use-case material
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTitle("HireSift CV screener");
                    setUseCase(SAMPLE_USE_CASE);
                  }}
                  className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60 hover:text-ink transition-colors"
                  style={{ color: "var(--seal)" }}
                >
                  Load specimen →
                </button>
              </div>
            </div>

            <div className="border-b py-6" style={{ borderColor: "var(--rule)" }}>
              <Label
                htmlFor="title"
                className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60 mb-2 block"
              >
                Title — optional
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. HireSift CV screener"
                className="border-0 rounded-none bg-transparent px-0 font-serif text-2xl focus-visible:ring-0 shadow-none placeholder:text-ink/30"
              />
            </div>

            <div className="border-b py-6" style={{ borderColor: "var(--rule)" }}>
              <Label
                htmlFor="usecase"
                className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60 mb-2 block"
              >
                Description of the system
              </Label>
              <Textarea
                id="usecase"
                rows={12}
                value={useCase}
                onChange={(e) => {
                  setUseCase(e.target.value);
                  if (leaderDecision) setLeaderDecision(null);
                }}
                placeholder="Purpose, intended users, affected persons, inputs, outputs, automation level, human oversight, GPAI usage…  You can also paste a public URL (PDF / HTML) and the system will fetch and read it."
                className="border-0 rounded-none bg-transparent px-0 font-serif text-lg leading-[1.6] resize-y focus-visible:ring-0 shadow-none placeholder:text-ink/30"
              />
            </div>

            {attachments.length > 0 && (
              <div className="border-b py-5" style={{ borderColor: "var(--rule)" }}>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60 mb-3">
                  Exhibits attached
                </div>
                <ul className="space-y-2">
                  {attachments.map((a, i) => (
                    <li key={a.id} className="flex items-center gap-3 font-serif text-sm">
                      <span className="font-mono text-[10px] text-ink/40 w-6">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <FileText className="size-3.5 text-ink/50" strokeWidth={1.25} />
                      <span className="flex-1 truncate">{a.name}</span>
                      <span className="font-mono text-[10px] text-ink/50">
                        {(a.size / 1024).toFixed(0)} KB
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(a.id)}
                        className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40 hover:text-seal transition-colors"
                        aria-label={`Remove ${a.name}`}
                      >
                        Strike
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 pt-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
                {submissionLength.toLocaleString()} / {ASSESSMENT_INPUT_LIMIT.toLocaleString()}{" "}
                characters
                {attachments.length > 0 &&
                  ` · ${attachments.length} exhibit${attachments.length === 1 ? "" : "s"}`}
                {hasTrimmedSubmission && " · excerpted"}
                {extractingFile && (
                  <span className="ml-2 text-ink/80">· reading {extractingFile}…</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPT_ATTR}
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={extracting}
                  className="font-mono text-[11px] uppercase tracking-[0.2em] py-3 px-5 border hover:bg-ink/5 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                  style={{ borderColor: "var(--ink)" }}
                >
                  {extracting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Paperclip className="size-3.5" />
                  )}
                  {extracting
                    ? extractProgress && extractProgress.total > 1
                      ? `Reading ${extractProgress.done + 1}/${extractProgress.total}…`
                      : "Reading exhibit…"
                    : "Attach exhibit"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const submission = buildSubmission();
                    if (submission.length < 20) {
                      toast.error("Add at least a paragraph before convening.");
                      return;
                    }
                    // If the leader already asked the user for more info and they
                    // press the button again, treat that as an explicit override
                    // and skip straight to the assessment council.
                    if (leaderDecision && leaderDecision.next === "ask_user") {
                      runMut.mutate({ useCase: submission, title: title || undefined });
                      return;
                    }
                    leaderMut.mutate({ useCase: submission, title: title || undefined });
                  }}
                  disabled={
                    runMut.isPending ||
                    leaderMut.isPending ||
                    submissionLength < 20 ||
                    !corpusReady
                  }
                  className="font-mono text-[11px] uppercase tracking-[0.2em] py-3 px-5 text-paper hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-2"
                  style={{ background: "var(--ink)" }}
                >
                  {leaderMut.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Play className="size-3.5" />
                  )}
                  {leaderMut.isPending
                    ? "Leader routing…"
                    : runMut.isPending
                      ? "Council in session…"
                      : leaderDecision && leaderDecision.next === "ask_user"
                        ? "Convene anyway →"
                        : "Convene council →"}
                </button>
              </div>
            </div>

            {leaderDecision && (
              <div
                className="mt-6 border-t border-b py-5"
                style={{
                  borderColor:
                    leaderDecision.next === "ask_user" ? "var(--seal)" : "var(--ink)",
                }}
              >
                <div className="flex items-baseline justify-between">
                  <div
                    className="font-mono text-[10px] uppercase tracking-[0.2em]"
                    style={{
                      color:
                        leaderDecision.next === "ask_user" ? "var(--seal)" : "var(--ink)",
                    }}
                  >
                    {leaderDecision.next === "ask_user"
                      ? "Leader agent · more detail recommended"
                      : "Leader agent · ready to convene"}
                  </div>
                  <div
                    className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/70"
                  >
                    Readiness {Math.round((leaderDecision.readiness_score ?? 0) * 100)}%
                  </div>
                </div>
                {Object.keys(leaderDecision.coverage ?? {}).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                    {Object.entries(leaderDecision.coverage).map(([k, v]) => (
                      <span
                        key={k}
                        className="font-mono text-[10px] uppercase tracking-[0.15em] px-1.5 py-0.5 border"
                        style={{
                          borderColor: "var(--rule)",
                          color: v ? "var(--ink)" : "var(--seal)",
                          opacity: v ? 0.85 : 1,
                        }}
                        title={v ? "covered" : "noted gap"}
                      >
                        {v ? "✓" : "✗"} {k.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-3 font-serif text-base italic text-ink/80">
                  {leaderDecision.rationale}
                </p>
                {leaderDecision.missing_questions?.length > 0 && (
                  <div className="mt-5">
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60 mb-3">
                      Answer below — the leader will re-evaluate and convene the council if ready
                    </div>
                    <ol className="space-y-4 list-decimal pl-5">
                      {leaderDecision.missing_questions.map((q, i) => (
                        <li key={i} className="font-serif text-sm text-ink/80">
                          <div className="mb-1.5">{q}</div>
                          <Textarea
                            rows={2}
                            value={leaderAnswers[i] ?? ""}
                            onChange={(e) =>
                              setLeaderAnswers((prev) => ({ ...prev, [i]: e.target.value }))
                            }
                            placeholder="Your answer…"
                            className="border rounded-none bg-transparent px-3 py-2 font-serif text-sm leading-[1.5] resize-y focus-visible:ring-0 shadow-none placeholder:text-ink/30"
                            style={{ borderColor: "var(--rule)" }}
                          />
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {leaderDecision.missing_questions?.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const qa = leaderDecision.missing_questions
                          .map((q, i) => {
                            const a = (leaderAnswers[i] ?? "").trim();
                            return a ? `Q: ${q}\nA: ${a}` : null;
                          })
                          .filter(Boolean)
                          .join("\n\n");
                        if (!qa) {
                          toast.error("Answer at least one question first.");
                          return;
                        }
                        const merged = (
                          buildRawSubmission() +
                          "\n\n--- Clarifications from the user ---\n" +
                          qa
                        ).slice(0, ASSESSMENT_INPUT_LIMIT);
                        // Persist into the textarea so the user sees what was sent
                        // and so subsequent runs include it.
                        setUseCase(
                          (prev) =>
                            prev + "\n\n--- Clarifications from the user ---\n" + qa,
                        );
                        setLeaderDecision(null);
                        leaderMut.mutate({ useCase: merged, title: title || undefined });
                      }}
                      disabled={leaderMut.isPending || runMut.isPending || !corpusReady}
                      className="font-mono text-[11px] uppercase tracking-[0.2em] py-2.5 px-4 text-paper hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-2"
                      style={{ background: "var(--ink)" }}
                    >
                      {leaderMut.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Play className="size-3.5" />
                      )}
                      Submit answers & re-evaluate →
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setLeaderDecision(null);
                      setLeaderAnswers({});
                      if (typeof document !== "undefined") {
                        const el = document.getElementById("usecase") as HTMLTextAreaElement | null;
                        el?.focus();
                      }
                    }}
                    className="font-mono text-[11px] uppercase tracking-[0.2em] py-2.5 px-4 border hover:bg-ink/5 transition-colors"
                    style={{ borderColor: "var(--ink)" }}
                  >
                    Edit the description instead
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const submission = buildSubmission();
                      runMut.mutate({ useCase: submission, title: title || undefined });
                    }}
                    disabled={runMut.isPending || !corpusReady}
                    className="font-mono text-[11px] uppercase tracking-[0.2em] py-2.5 px-4 hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-2"
                    style={
                      leaderDecision.next === "ask_user"
                        ? { border: "1px solid var(--seal)", color: "var(--seal)" }
                        : { background: "var(--ink)", color: "var(--paper)" }
                    }
                  >
                    {runMut.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Play className="size-3.5" />
                    )}
                    {leaderDecision.next === "ask_user"
                      ? "Convene anyway"
                      : "Convene the council"}
                  </button>
                </div>
              </div>
            )}

            <p className="mt-4 font-serif italic text-xs text-ink/50">
              Accepts PDF, Word, Markdown and plain text. Up to 10 MB per exhibit. Long PDFs are
              sampled and capped at 20,000 characters before the council convenes.
            </p>
            {!corpusReady && (
              <p
                className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em]"
                style={{ color: "var(--seal)" }}
              >
                Seed the corpus before filing
              </p>
            )}
          </section>

          {/* Right: pipeline as table of articles */}
          <aside>
            <div className="border-t border-b py-3" style={{ borderColor: "var(--ink)" }}>
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60">
                The Council · Leader + I—VI
              </div>
            </div>
            <ol>
              {PIPELINE_AGENTS.map((a) => (
                <li
                  key={a.n}
                  className="border-b py-4 flex items-start gap-4"
                  style={{ borderColor: "var(--rule)" }}
                >
                  <span
                    className="font-serif text-xl leading-none"
                    style={{ color: "var(--seal)" }}
                  >
                    {a.n}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-serif text-base leading-tight">{a.title}</div>
                    <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/50">
                      {a.tag}
                    </div>
                  </div>
                  <a.icon className="size-3.5 text-ink/40 mt-1" strokeWidth={1.25} />
                </li>
              ))}
            </ol>
          </aside>
        </div>

        {/* Report / empty state */}
        <div className="mt-20">
          {runMut.isPending ? (
            <div className="border-t border-b py-16" style={{ borderColor: "var(--ink)" }}>
              <div className="grid md:grid-cols-12 gap-8">
                <div className="md:col-span-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
                  In session
                </div>
                <div className="md:col-span-10">
                  <h2 className="font-serif text-4xl leading-[1.05] tracking-tight">
                    The council is{" "}
                    <span className="italic" style={{ color: "var(--seal)" }}>
                      deliberating.
                    </span>
                  </h2>
                  <p className="mt-4 font-serif text-lg text-ink/70 leading-snug max-w-xl">
                    Extracting facts → retrieving Articles → reasoning → verifying citations.
                  </p>
                  <div className="mt-8 space-y-2">
                    <Skeleton className="h-3 w-3/4 rounded-none" />
                    <Skeleton className="h-3 w-full rounded-none" />
                    <Skeleton className="h-3 w-5/6 rounded-none" />
                    <Skeleton className="h-3 w-2/3 rounded-none" />
                  </div>
                </div>
              </div>
            </div>
          ) : currentResult ? (
            <>
              {leaderDecision && (
                <section
                  className="border-t border-b py-6 mb-10 grid md:grid-cols-12 gap-8"
                  style={{ borderColor: "var(--rule)" }}
                >
                  <div className="md:col-span-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
                    Leader · Routing
                  </div>
                  <div className="md:col-span-10 space-y-3">
                    <div className="flex items-baseline gap-4 flex-wrap">
                      <div className="font-serif text-xl tracking-tight">
                        {leaderDecision.next === "assessment"
                          ? "Council convened directly — input was complete enough."
                          : "Council convened with noted gaps."}
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
                        Readiness {Math.round((leaderDecision.readiness_score ?? 0) * 100)}%
                      </span>
                    </div>
                    {leaderDecision.rationale && (
                      <p className="font-serif italic text-base text-ink/75 leading-snug max-w-3xl">
                        {leaderDecision.rationale}
                      </p>
                    )}
                    {Object.keys(leaderDecision.coverage ?? {}).length > 0 && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {Object.entries(leaderDecision.coverage).map(([k, v]) => (
                          <span
                            key={k}
                            className="font-mono text-[10px] uppercase tracking-[0.15em] px-1.5 py-0.5 border"
                            style={{
                              borderColor: "var(--rule)",
                              color: v ? "var(--ink)" : "var(--seal)",
                              opacity: v ? 0.85 : 1,
                            }}
                            title={v ? "covered" : "noted gap"}
                          >
                            {v ? "✓" : "✗"} {k.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    )}
                    {(leaderDecision.missing_questions ?? []).length > 0 && (
                      <details className="font-serif text-sm text-ink/75">
                        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55 hover:text-ink">
                          Noted follow-up questions ({leaderDecision.missing_questions.length})
                        </summary>
                        <ul className="mt-2 space-y-1 list-disc pl-5">
                          {leaderDecision.missing_questions.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </section>
              )}
              <AssessmentReport result={currentResult} />
              <FollowUpChat
                sessionId={currentResult.sessionId}
                onRevised={() => void openSession(currentResult.sessionId)}
              />
            </>
          ) : (
            <div
              className="border-t border-b py-20 text-center"
              style={{ borderColor: "var(--rule)" }}
            >
              <div className="font-serif text-6xl leading-none" style={{ color: "var(--seal)" }}>
                §
              </div>
              <div className="mt-6 font-serif text-2xl tracking-tight">
                The opinion will be entered here.
              </div>
              <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
                Six sections · facts & assumptions separated · every claim cited
              </div>
            </div>
          )}
        </div>

        {/* Recent sessions — table of priors */}
        <section className="mt-24">
          <div className="grid md:grid-cols-12 gap-8 mb-8">
            <div className="md:col-span-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
              Part IV
            </div>
            <div className="md:col-span-10 flex items-end justify-between gap-4">
              <div>
                <h2 className="font-serif text-4xl leading-tight tracking-tight">
                  Priors on{" "}
                  <span className="italic" style={{ color: "var(--seal)" }}>
                    record.
                  </span>
                </h2>
                <p className="mt-2 font-serif italic text-sm text-ink/60">
                  Click any prior to reopen its opinion.
                </p>
              </div>
              {(sessions.data?.length ?? 0) > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm("Delete all sessions? This cannot be undone."))
                      clearMut.mutate();
                  }}
                  disabled={clearMut.isPending}
                  className="font-mono text-[10px] uppercase tracking-[0.2em] py-2 px-3 border hover:bg-ink/5 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                  style={{ borderColor: "var(--ink)" }}
                >
                  <Trash2 className="size-3" />
                  {clearMut.isPending ? "Clearing…" : "Strike all"}
                </button>
              )}
            </div>
          </div>

          {/* Portfolio-level risk distribution */}
          {(sessions.data?.length ?? 0) > 0 &&
            (() => {
              const tiers: Record<string, number> = {
                prohibited: 0,
                high: 0,
                limited: 0,
                minimal: 0,
                gpai: 0,
                unclear: 0,
              };
              let art5 = 0;
              for (const s of sessions.data!) {
                const a = Array.isArray(s.assessments) ? s.assessments[0] : null;
                const t = (a?.risk_tier as string) || "unclear";
                tiers[t] = (tiers[t] ?? 0) + 1;
                const banner = (a?.art5_banner ?? {}) as { triggered?: boolean };
                if (banner.triggered) art5 += 1;
              }
              const order: { key: string; label: string }[] = [
                { key: "prohibited", label: "Prohibited" },
                { key: "high", label: "High-risk" },
                { key: "gpai", label: "GPAI" },
                { key: "limited", label: "Limited" },
                { key: "minimal", label: "Minimal" },
                { key: "unclear", label: "Unclear" },
              ];
              return (
                <div
                  className="border-t border-b mb-8 grid grid-cols-3 md:grid-cols-7"
                  style={{ borderColor: "var(--rule)" }}
                >
                  {order.map((o, i) => (
                    <div
                      key={o.key}
                      className={`py-5 px-4 ${i > 0 ? "border-l" : ""}`}
                      style={{ borderColor: "var(--rule)" }}
                    >
                      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink/55">
                        {o.label}
                      </div>
                      <div
                        className="mt-1 font-serif text-3xl leading-none tracking-tight"
                        style={{
                          color:
                            o.key === "prohibited" || o.key === "high"
                              ? "var(--seal)"
                              : undefined,
                        }}
                      >
                        {tiers[o.key] ?? 0}
                      </div>
                    </div>
                  ))}
                  <div
                    className="py-5 px-4 border-l col-span-3 md:col-span-1"
                    style={{ borderColor: "var(--rule)" }}
                  >
                    <div
                      className="font-mono text-[9px] uppercase tracking-[0.2em]"
                      style={{ color: "var(--seal)" }}
                    >
                      Art. 5 flagged
                    </div>
                    <div
                      className="mt-1 font-serif text-3xl leading-none tracking-tight"
                      style={{ color: "var(--seal)" }}
                    >
                      {art5}
                    </div>
                  </div>
                </div>
              );
            })()}

          {sessions.isLoading && <Skeleton className="h-20 w-full rounded-none" />}
          {sessions.data?.length === 0 && (
            <div
              className="border-t border-b py-10 text-center font-serif italic text-ink/60"
              style={{ borderColor: "var(--rule)" }}
            >
              No priors yet — file your first use-case above.
            </div>
          )}
          {(sessions.data?.length ?? 0) > 0 && (
            <table className="w-full font-serif border-t" style={{ borderColor: "var(--ink)" }}>
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50 text-left">
                  <th className="py-3 w-12">№</th>
                  <th className="py-3">Title</th>
                  <th className="py-3 hidden md:table-cell">Filed</th>
                  <th className="py-3 hidden md:table-cell">Risk</th>
                  <th className="py-3 hidden md:table-cell">Role</th>
                  <th className="py-3 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {sessions.data!.map((s, i) => {
                  const a = Array.isArray(s.assessments) ? s.assessments[0] : null;
                  const isLoading = loadingSessionId === s.id;
                  const isActive = currentResult?.sessionId === s.id;
                  return (
                    <tr
                      key={s.id}
                      className="border-t group align-baseline"
                      style={{ borderColor: "var(--rule)" }}
                    >
                      <td className="py-5 font-mono text-xs text-ink/40">
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td className="py-5">
                        <button
                          onClick={() => openSession(s.id)}
                          disabled={isLoading || !a}
                          className="text-left disabled:opacity-50 hover:italic transition-all"
                          style={isActive ? { color: "var(--seal)" } : undefined}
                        >
                          <span className="text-lg">{s.title || "Untitled filing"}</span>
                          {isLoading && (
                            <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40">
                              loading…
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="py-5 hidden md:table-cell font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
                        {new Date(s.created_at).toLocaleDateString(undefined, {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td
                        className="py-5 hidden md:table-cell font-mono text-[10px] uppercase tracking-[0.15em]"
                        style={{ color: a?.risk_tier ? "var(--seal)" : undefined }}
                      >
                        {a?.risk_tier ?? "—"}
                      </td>
                      <td className="py-5 hidden md:table-cell italic text-sm text-ink/60">
                        {a?.role_determination ?? "—"}
                      </td>
                      <td className="py-5 text-right">
                        <button
                          onClick={() => {
                            if (window.confirm("Delete this session?")) {
                              if (currentResult?.sessionId === s.id) setCurrentResult(null);
                              delMut.mutate(s.id);
                            }
                          }}
                          className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40 hover:text-seal transition-colors opacity-0 group-hover:opacity-100"
                          aria-label="Delete session"
                        >
                          Strike
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <footer
          className="mt-24 pt-8 border-t font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50 grid md:grid-cols-12 gap-8"
          style={{ borderColor: "var(--rule)" }}
        >
          <div className="md:col-span-4">
            <span className="font-serif italic text-lg normal-case tracking-normal text-ink block mb-1">
              Colophon
            </span>
            ReguLens · MMXXVI · AI For Good Hackathon
          </div>
          <div className="md:col-span-8 normal-case tracking-normal font-serif text-sm italic text-ink/60">
            Output is informational only and does not constitute legal advice. Findings must be
            reviewed by qualified counsel before any decision of record.
          </div>
        </footer>
      </main>
    </div>
  );
}
