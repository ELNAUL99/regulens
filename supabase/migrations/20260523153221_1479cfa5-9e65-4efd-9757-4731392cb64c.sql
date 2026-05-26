DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP FUNCTION IF EXISTS public.has_role(UUID, public.app_role);

REVOKE ALL ON TABLE public.user_roles FROM anon, authenticated;
GRANT SELECT ON TABLE public.user_roles TO authenticated;