-- Drop dependency on service role: let any authenticated user reseed the corpus.
-- Adds write policies on corpus_chunks + regression_tests, plus unique indexes
-- so seeding is an idempotent upsert (safe under concurrent calls).

-- corpus_chunks: any authenticated user may insert/update/delete.
CREATE POLICY "Corpus chunks writable by authenticated"
  ON public.corpus_chunks FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Corpus chunks updatable by authenticated"
  ON public.corpus_chunks FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "Corpus chunks deletable by authenticated"
  ON public.corpus_chunks FOR DELETE TO authenticated
  USING (true);

-- Natural key for upsert: an article + annex point should appear at most once.
-- NULLS NOT DISTINCT (PG15+) so a NULL annex_point participates in uniqueness;
-- onConflict('article_id,annex_point') in PostgREST then matches this index.
CREATE UNIQUE INDEX IF NOT EXISTS uq_corpus_chunks_article_annex
  ON public.corpus_chunks (article_id, annex_point) NULLS NOT DISTINCT;

-- regression_tests: any authenticated user may insert/update/delete.
CREATE POLICY "Regression tests writable by authenticated"
  ON public.regression_tests FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Regression tests updatable by authenticated"
  ON public.regression_tests FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "Regression tests deletable by authenticated"
  ON public.regression_tests FOR DELETE TO authenticated
  USING (true);

CREATE UNIQUE INDEX IF NOT EXISTS uq_regression_tests_name
  ON public.regression_tests (name);
