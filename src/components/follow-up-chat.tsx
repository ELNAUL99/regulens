import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, MessageSquare, RotateCw } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { listMessages, sendMessage } from "@/lib/chat.functions";
import { reviseAssessment } from "@/lib/assessment.functions";

type Msg = { id: string; role: "user" | "assistant"; content: string; created_at: string };

export function FollowUpChat({
  sessionId,
  onRevised,
}: {
  sessionId: string;
  onRevised?: () => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMessages);
  const sendFn = useServerFn(sendMessage);
  const reviseFn = useServerFn(reviseAssessment);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const messages = useQuery({
    queryKey: ["messages", sessionId],
    queryFn: () => listFn({ data: { sessionId } }) as Promise<Msg[]>,
  });

  const send = useMutation({
    mutationFn: (content: string) => sendFn({ data: { sessionId, content } }),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["messages", sessionId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revise = useMutation({
    mutationFn: (additionalContext: string) =>
      reviseFn({ data: { sessionId, additionalContext } }),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["messages", sessionId] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Assessment revised with your new information");
      onRevised?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data?.length, send.isPending]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const c = draft.trim();
    if (!c || send.isPending) return;
    send.mutate(c);
  };

  const list = messages.data ?? [];

  return (
    <section
      className="border-t mt-12 pt-10 pb-4"
      style={{ borderColor: "var(--rule)" }}
      aria-label="Follow-up chat"
    >
      <div className="grid md:grid-cols-12 gap-8 mb-6">
        <div className="md:col-span-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
          Part VII
        </div>
        <div className="md:col-span-10">
          <h3 className="font-serif text-3xl leading-tight tracking-tight flex items-baseline gap-3">
            <MessageSquare className="size-5 text-ink/40" strokeWidth={1.25} />
            Examination of counsel
          </h3>
          <p className="mt-2 font-serif italic text-sm text-ink/60">
            Ask the council to elaborate on its opinion — answers stay grounded in the assessment above.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-8">
        <div className="hidden md:block md:col-span-2" />
        <div className="md:col-span-10">
          <div
            className="border-t"
            style={{ borderColor: "var(--rule)" }}
          >
            {list.length === 0 && !messages.isLoading && (
              <div className="py-6 font-serif italic text-ink/50 text-base">
                No questions on the record yet.
              </div>
            )}
            {list.map((m) => (
              <div
                key={m.id}
                className="border-b py-5 grid grid-cols-12 gap-4"
                style={{ borderColor: "var(--rule)" }}
              >
                <div
                  className="col-span-3 md:col-span-2 font-mono text-[10px] uppercase tracking-[0.18em] pt-1"
                  style={{ color: m.role === "assistant" ? "var(--seal)" : undefined }}
                >
                  {m.role === "assistant" ? "Council" : "Counsel"}
                </div>
                <div className="col-span-9 md:col-span-10 font-serif text-base leading-snug text-ink/85 whitespace-pre-wrap">
                  {m.content}
                </div>
              </div>
            ))}
            {send.isPending && (
              <div className="py-5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
                <Loader2 className="size-3 animate-spin" />
                Council deliberating…
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={onSubmit} className="mt-6 flex gap-3 items-end">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit(e);
              }}
              placeholder="Ask a follow-up question — e.g. What would move this from high-risk to limited-risk?"
              rows={3}
              className="font-serif text-base rounded-none border-ink/30 focus-visible:ring-0 focus-visible:border-ink"
              disabled={send.isPending}
            />
            <div className="flex flex-col gap-2 shrink-0">
              <button
                type="submit"
                disabled={send.isPending || revise.isPending || !draft.trim()}
                className="font-mono text-[11px] uppercase tracking-[0.2em] py-3.5 px-5 text-paper transition-opacity hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-2"
                style={{ background: "var(--ink)" }}
              >
                {send.isPending ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                Submit
              </button>
              <button
                type="button"
                disabled={revise.isPending || send.isPending || draft.trim().length < 10}
                onClick={() => revise.mutate(draft.trim())}
                className="font-mono text-[11px] uppercase tracking-[0.2em] py-3.5 px-5 border transition-colors hover:bg-ink/5 disabled:opacity-40 inline-flex items-center gap-2"
                style={{ borderColor: "var(--ink)" }}
                title="Re-run the council with this text as additional context. Stores a new assessment row."
              >
                {revise.isPending ? <Loader2 className="size-3 animate-spin" /> : <RotateCw className="size-3" />}
                Revise opinion
              </button>
            </div>
          </form>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/40">
            ⌘/Ctrl + Enter to send · "Revise opinion" re-runs the council with your text as new context
          </p>
        </div>
      </div>
    </section>
  );
}