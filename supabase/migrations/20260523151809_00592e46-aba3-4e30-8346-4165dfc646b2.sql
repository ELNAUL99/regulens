CREATE POLICY "Users can delete their own assessments"
ON public.assessments
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.sessions s
  WHERE s.id = assessments.session_id AND s.user_id = auth.uid()
));