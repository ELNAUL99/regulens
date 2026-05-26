import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Sign in — ReguLens" },
      { name: "description", content: "Sign in to ReguLens to assess AI systems against the EU AI Act." },
    ],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (signUpError) throw signUpError;
        toast.success("Account created. Signing you in…");
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen font-sans flex flex-col"
      style={{ background: "var(--paper)", color: "var(--ink)" }}
    >
      {/* Masthead strip */}
      <div
        className="border-b font-mono text-[10px] uppercase tracking-[0.2em]"
        style={{ borderColor: "var(--rule)" }}
      >
        <div className="container mx-auto px-8 py-2.5 flex justify-between items-center text-ink/60">
          <span>Regulation (EU) 2024/1689 · Working Edition</span>
          <span className="hidden md:inline">Registry of Counsel</span>
          <span>Bruxelles · MMXXVI</span>
        </div>
      </div>

      <header>
        <div className="container mx-auto px-8 py-6 flex justify-between items-center">
          <Link to="/" className="flex items-baseline gap-3">
            <span className="font-serif text-3xl leading-none tracking-tight">ReguLens</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
              Est. MMXXVI
            </span>
          </Link>
          <Link
            to="/"
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60 hover:text-ink transition-colors"
          >
            ← Return to folio
          </Link>
        </div>
        <div className="border-b" style={{ borderColor: "var(--rule)" }} />
        <div className="border-b mt-px" style={{ borderColor: "var(--rule)" }} />
      </header>

      <main className="flex-1 flex items-center">
        <div className="container mx-auto px-8 py-16 grid md:grid-cols-12 gap-12 items-start">
          {/* Left: editorial preamble */}
          <div className="md:col-span-6 lg:col-span-7">
            <div
              className="font-serif text-[5rem] leading-none"
              style={{ color: "var(--seal)" }}
            >
              §
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50 mt-2 mb-6">
              Registration of counsel
            </div>
            <h1 className="font-serif text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.98] tracking-[-0.02em]">
              {mode === "signin" ? (
                <>
                  Resume your{" "}
                  <span className="italic" style={{ color: "var(--seal)" }}>
                    dossier.
                  </span>
                </>
              ) : (
                <>
                  Open a{" "}
                  <span className="italic" style={{ color: "var(--seal)" }}>
                    new dossier.
                  </span>
                </>
              )}
            </h1>
            <p className="mt-8 font-serif text-xl leading-[1.4] text-ink/70 max-w-lg">
              Submissions are kept under your seal. Six specialised agents will
              extract the facts, retrieve the governing articles, deliberate, and
              return a cited opinion.
            </p>
          </div>

          {/* Right: ledger form */}
          <div className="md:col-span-6 lg:col-span-5">
            <div
              className="border-t border-b py-1"
              style={{ borderColor: "var(--ink)" }}
            >
              <div className="border-t border-b py-8 px-8" style={{ borderColor: "var(--ink)" }}>
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50 mb-1">
                  Form A · {mode === "signin" ? "Authentication" : "Registration"}
                </div>
                <h2 className="font-serif text-3xl leading-tight tracking-tight mb-8">
                  {mode === "signin" ? "Sign in" : "Create an account"}
                </h2>
                <form onSubmit={submit} className="space-y-6">
                  <div className="space-y-2">
                    <Label
                      htmlFor="email"
                      className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60"
                    >
                      Electronic address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="border-0 border-b rounded-none bg-transparent px-0 font-serif text-lg focus-visible:ring-0 focus-visible:border-ink shadow-none"
                      style={{ borderColor: "var(--rule)" }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="password"
                      className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60"
                    >
                      Passphrase
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="border-0 border-b rounded-none bg-transparent px-0 font-serif text-lg focus-visible:ring-0 focus-visible:border-ink shadow-none"
                      style={{ borderColor: "var(--rule)" }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full font-mono text-[11px] uppercase tracking-[0.2em] py-4 px-5 text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: "var(--ink)" }}
                  >
                    {loading
                      ? "Filing…"
                      : mode === "signin"
                      ? "Sign in →"
                      : "Register →"}
                  </button>
                  <div className="flex justify-between items-center pt-2">
                    <button
                      type="button"
                      className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60 hover:text-ink transition-colors"
                      onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                    >
                      {mode === "signin" ? "Register instead" : "Sign in instead"}
                    </button>
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">
                      Form A · 01
                    </span>
                  </div>
                </form>
              </div>
            </div>
            <p className="mt-6 font-serif italic text-sm text-ink/50 leading-snug">
              By registering, counsel acknowledges that ReguLens output is a
              preliminary triage, not legal advice.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t" style={{ borderColor: "var(--rule)" }}>
        <div className="container mx-auto px-8 py-6 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50 flex justify-between">
          <span>ReguLens · MMXXVI</span>
          <span className="hidden md:inline">Set in Instrument Serif & JetBrains Mono</span>
        </div>
      </footer>
    </div>
  );
}