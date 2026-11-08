-- QA47 applied to real Supabase Free project in Seoul (2026-11-08).
-- Migration name: qa47_authenticated_guardian_status_invoker_rpc
-- Only verified guardian family IDs belonging to the authenticated user's JWT.
-- Read-only, SECURITY INVOKER, with explicit GRANT authenticated / REVOKE anon.
-- Do not expose the qa44 schema or family snapshots through this function.
CREATE FUNCTION public.qa47_my_verified_family_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT m.family_id
  FROM qa44.guardian_memberships AS m
  WHERE m.guardian_user_id = (SELECT auth.uid())
    AND m.role = 'guardian'
    AND m.verification_source = 'externally_verified'
    AND m.verified_at IS NOT NULL
    AND m.consent_verified_at IS NOT NULL
    AND m.revoked_at IS NULL
  ORDER BY m.family_id
$$;
REVOKE ALL ON FUNCTION public.qa47_my_verified_family_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa47_my_verified_family_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.qa47_my_verified_family_ids() TO authenticated;
