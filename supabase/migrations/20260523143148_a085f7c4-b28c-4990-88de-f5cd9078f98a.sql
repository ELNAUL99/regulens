-- Initial schema: sessions, documents, assessments, messages, corpus_chunks, regression_tests.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content TEXT NOT NULL,
  file_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.corpus_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id TEXT NOT NULL,
  title TEXT,
  annex_point TEXT,
  source_type TEXT NOT NULL DEFAULT 'regulation',
  authority TEXT NOT NULL DEFAULT 'eu',
  version TEXT NOT NULL DEFAULT '2024-08-01',
  status TEXT NOT NULL DEFAULT 'final',
  content TEXT NOT NULL,
  embedding vector(1024),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_corpus_chunks_embedding ON public.corpus_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_corpus_chunks_article_id ON public.corpus_chunks (article_id);

CREATE TABLE public.assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  summary TEXT,
  facts JSONB DEFAULT '{}',
  preliminary_assessment JSONB DEFAULT '{}',
  governance_observations JSONB DEFAULT '{}',
  missing_info JSONB DEFAULT '[]',
  citations JSONB DEFAULT '[]',
  confidence JSONB DEFAULT '{}',
  art5_banner JSONB DEFAULT '{}',
  role_determination TEXT,
  risk_tier TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.regression_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  input TEXT NOT NULL,
  expected_art5_banner JSONB,
  expected_risk_tier TEXT,
  expected_annex_point TEXT,
  expected_role TEXT,
  last_run_at TIMESTAMP WITH TIME ZONE,
  last_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_session ON public.messages(session_id, created_at);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corpus_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regression_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Sessions
CREATE POLICY "Users can create their own sessions" ON public.sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own sessions" ON public.sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own sessions" ON public.sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own sessions" ON public.sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Documents
CREATE POLICY "Users can create documents in their sessions" ON public.documents FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = documents.session_id AND s.user_id = auth.uid()));
CREATE POLICY "Users can view documents in their sessions" ON public.documents FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = documents.session_id AND s.user_id = auth.uid()));
CREATE POLICY "Users can delete documents in their sessions" ON public.documents FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = documents.session_id AND s.user_id = auth.uid()));

-- Assessments
CREATE POLICY "Users can create assessments for their sessions" ON public.assessments FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = assessments.session_id AND s.user_id = auth.uid()));
CREATE POLICY "Users can view their own assessments" ON public.assessments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = assessments.session_id AND s.user_id = auth.uid()));
CREATE POLICY "Users can update their own assessments" ON public.assessments FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = assessments.session_id AND s.user_id = auth.uid()));

-- Messages
CREATE POLICY "Users can view messages in their sessions" ON public.messages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = messages.session_id AND s.user_id = auth.uid()));
CREATE POLICY "Users can create messages in their sessions" ON public.messages FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = messages.session_id AND s.user_id = auth.uid()));
CREATE POLICY "Users can delete messages in their sessions" ON public.messages FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = messages.session_id AND s.user_id = auth.uid()));

-- Corpus chunks: public read
CREATE POLICY "Corpus chunks are readable by all" ON public.corpus_chunks FOR SELECT USING (true);

-- Regression tests
CREATE POLICY "Regression tests are readable by authenticated" ON public.regression_tests FOR SELECT TO authenticated USING (true);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_assessments_updated_at BEFORE UPDATE ON public.assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vector match function
CREATE FUNCTION public.match_corpus_chunks(
  query_embedding vector,
  match_count integer DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  article_id text,
  title text,
  annex_point text,
  content text,
  source_type text,
  similarity double precision
)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT c.id, c.article_id, c.title, c.annex_point, c.content, c.source_type,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.corpus_chunks c
  WHERE c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;