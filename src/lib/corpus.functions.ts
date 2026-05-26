import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CORPUS_SEED, REGRESSION_SEED } from "./corpus-seed.server";
import { verdaEmbed } from "./llm.server";

/** Seeder: embeds all corpus chunks via Verda bge-m3 and upserts them.
 *  Idempotent — relies on UNIQUE (article_id, coalesce(annex_point,'')) and
 *  UNIQUE (regression_tests.name). Any authenticated user can call it; concurrent
 *  calls are safe because upsert collapses to the same final state. Note: this
 *  burns Verda embedding quota every time it's called. */
export const seedCorpus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const inputs = CORPUS_SEED.map((c) => `${c.article_id} — ${c.title}\n\n${c.content}`);
    const vectors = await verdaEmbed(inputs);
    if (vectors.length !== CORPUS_SEED.length) {
      throw new Error(`Embedding count mismatch: got ${vectors.length}, expected ${CORPUS_SEED.length}`);
    }

    const rows = CORPUS_SEED.map((c, i) => ({
      article_id: c.article_id,
      title: c.title,
      annex_point: c.annex_point ?? null,
      source_type: c.source_type ?? "regulation",
      content: c.content,
      embedding: `[${vectors[i].join(",")}]` as unknown as never,
    }));

    for (const row of rows) {
      const { error } = await supabase
        .from("corpus_chunks")
        .upsert(row as never, { onConflict: "article_id,annex_point" });
      if (error) throw new Error(`Upsert failed for ${row.article_id}: ${error.message}`);
    }

    for (const t of REGRESSION_SEED) {
      const { error } = await supabase
        .from("regression_tests")
        .upsert(
          {
            name: t.name,
            description: t.description,
            input: t.input,
            expected_art5_banner: t.expected_art5_banner,
            expected_risk_tier: t.expected_risk_tier,
            expected_annex_point: t.expected_annex_point,
            expected_role: t.expected_role,
          },
          { onConflict: "name" },
        );
      if (error) throw new Error(`Regression upsert failed for ${t.name}: ${error.message}`);
    }

    return { ok: true, chunks: rows.length, tests: REGRESSION_SEED.length };
  });

/** Reports corpus state. */
export const corpusStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count } = await context.supabase
      .from("corpus_chunks")
      .select("*", { count: "exact", head: true });
    return { count: count ?? 0 };
  });
