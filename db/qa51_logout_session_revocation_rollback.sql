-- QA51 rollback candidate only. Review the live catalog before execution.
-- The Edge Function must be undeployed/disabled separately before this SQL.
BEGIN;

DROP POLICY IF EXISTS qa51_photo_session ON storage.objects;
DROP POLICY IF EXISTS qa51_family_session ON qa44.families;
DROP POLICY IF EXISTS qa51_snapshot_session ON qa44.family_snapshots;
DROP POLICY IF EXISTS qa51_membership_session ON qa44.guardian_memberships;

DROP FUNCTION IF EXISTS public.qa51_revoke_session(uuid,boolean);

-- Restore the exact QA47 SECURITY INVOKER contract that QA51 replaces.
CREATE OR REPLACE FUNCTION public.qa47_my_verified_family_ids()
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

DROP FUNCTION IF EXISTS qa44.revoke_current_session(uuid,boolean);
DROP FUNCTION IF EXISTS qa44.session_allowed();
DROP TABLE IF EXISTS qa44.logout_operation;
DROP TABLE IF EXISTS qa44.logout_session_tombstone;
DROP TABLE IF EXISTS qa44.logout_user_epoch;

COMMIT;

-- This restores source objects and grants only. It cannot re-authorize JWTs
-- already rejected by clients or remove cached/signed URLs. Validate those
-- separately and never describe this file as a tested production rollback.
