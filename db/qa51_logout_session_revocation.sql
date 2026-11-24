-- QA51 / 00Q-02-AUTH. Deployment candidate only, not applied.
-- Trusted PostgREST JWT claims + provider session creation time, never client epoch.
-- Apply only after review of live schema, existing policies and rollback plan.
BEGIN;
CREATE TABLE qa44.logout_user_epoch (
 user_id uuid PRIMARY KEY,
 revoked_before timestamptz NOT NULL DEFAULT '-infinity'
);
CREATE TABLE qa44.logout_session_tombstone (
 session_id uuid PRIMARY KEY, user_id uuid NOT NULL
);
CREATE TABLE qa44.logout_operation (
 user_id uuid NOT NULL, session_id uuid NOT NULL, operation_id uuid NOT NULL,
 global_scope boolean NOT NULL,
 PRIMARY KEY(user_id,session_id,operation_id)
);
ALTER TABLE qa44.logout_user_epoch ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa44.logout_session_tombstone ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa44.logout_operation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON qa44.logout_user_epoch,qa44.logout_session_tombstone,qa44.logout_operation FROM PUBLIC,anon,authenticated,qa44_sync_writer;

-- SECURITY DEFINER is necessary for auth.sessions/private ledger reads.
-- No client supplied user/session identity, no dynamic SQL, no row disclosure.
CREATE FUNCTION qa44.session_allowed() RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid := auth.uid(); s uuid;
BEGIN
 IF u IS NULL OR coalesce(auth.jwt()->>'is_anonymous','false') <> 'false' THEN RETURN false; END IF;
 s := (auth.jwt()->>'session_id')::uuid;
 IF s IS NULL THEN RETURN false; END IF;
 RETURN EXISTS (
  SELECT 1 FROM auth.sessions a
  WHERE a.id=s AND a.user_id=u
    AND a.created_at IS NOT NULL
    AND (a.not_after IS NULL OR a.not_after > statement_timestamp())
    AND a.created_at > coalesce((SELECT e.revoked_before FROM qa44.logout_user_epoch e WHERE e.user_id=u),'-infinity'::timestamptz)
    AND NOT EXISTS (SELECT 1 FROM qa44.logout_session_tombstone t WHERE t.session_id=s)
 );
EXCEPTION WHEN invalid_text_representation THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION qa44.session_allowed() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION qa44.session_allowed() TO authenticated,qa44_sync_writer;

-- Serialize per-user revocations. The operation receipt and cutoff/tombstone
-- commit together; retry of the identical scope cannot advance the cutoff.
CREATE FUNCTION qa44.revoke_current_session(p_operation uuid,p_global boolean)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid := auth.uid(); s uuid; previous_scope boolean;
BEGIN
 IF u IS NULL OR p_operation IS NULL OR p_global IS NULL
    OR coalesce(auth.jwt()->>'is_anonymous','false') <> 'false' THEN RETURN false; END IF;
 s := (auth.jwt()->>'session_id')::uuid;
 IF s IS NULL THEN RETURN false; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,0));
 SELECT o.global_scope INTO previous_scope FROM qa44.logout_operation o
  WHERE o.user_id=u AND o.session_id=s AND o.operation_id=p_operation;
 IF FOUND THEN RETURN previous_scope=p_global; END IF;
 IF NOT qa44.session_allowed() THEN RETURN false; END IF;
 IF p_global THEN
  INSERT INTO qa44.logout_user_epoch(user_id,revoked_before) VALUES(u,clock_timestamp())
   ON CONFLICT(user_id) DO UPDATE SET revoked_before=greatest(qa44.logout_user_epoch.revoked_before,EXCLUDED.revoked_before);
  -- Tombstone all known old IDs, even if the provider row remains.
  INSERT INTO qa44.logout_session_tombstone(session_id,user_id)
   SELECT a.id,u FROM auth.sessions a WHERE a.user_id=u
    AND a.created_at <= (SELECT e.revoked_before FROM qa44.logout_user_epoch e WHERE e.user_id=u)
   ON CONFLICT(session_id) DO NOTHING;
 ELSE
  INSERT INTO qa44.logout_session_tombstone(session_id,user_id) VALUES(s,u)
   ON CONFLICT(session_id) DO NOTHING;
 END IF;
 INSERT INTO qa44.logout_operation VALUES(u,s,p_operation,p_global);
 RETURN true;
EXCEPTION WHEN invalid_text_representation THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION qa44.revoke_current_session(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION qa44.revoke_current_session(uuid,boolean) TO authenticated;

-- Public wrappers are invoker only. Status fails rather than reporting a
-- revoked guardian as a valid user with zero families.
CREATE FUNCTION public.qa51_revoke_session(p_operation uuid,p_global boolean)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 SELECT qa44.revoke_current_session(p_operation,p_global)
$$;
REVOKE ALL ON FUNCTION public.qa51_revoke_session(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.qa51_revoke_session(uuid,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.qa47_my_verified_family_ids()
RETURNS SETOF uuid LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT qa44.session_allowed() THEN RAISE EXCEPTION 'SESSION_DENIED' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT m.family_id FROM qa44.guardian_memberships m
 WHERE m.guardian_user_id=auth.uid() AND m.role='guardian'
 AND m.verification_source='externally_verified' AND m.verified_at IS NOT NULL
 AND m.consent_verified_at IS NOT NULL AND m.revoked_at IS NULL ORDER BY m.family_id;
END $$;
-- Restrictive policies AND the existing family/consent predicates.
CREATE POLICY qa51_membership_session ON qa44.guardian_memberships AS RESTRICTIVE
 FOR ALL TO authenticated,qa44_sync_writer USING ((SELECT qa44.session_allowed())) WITH CHECK ((SELECT qa44.session_allowed()));
CREATE POLICY qa51_snapshot_session ON qa44.family_snapshots AS RESTRICTIVE
 FOR ALL TO authenticated,qa44_sync_writer USING ((SELECT qa44.session_allowed())) WITH CHECK ((SELECT qa44.session_allowed()));
CREATE POLICY qa51_family_session ON qa44.families AS RESTRICTIVE
 FOR ALL TO authenticated,qa44_sync_writer USING ((SELECT qa44.session_allowed())) WITH CHECK ((SELECT qa44.session_allowed()));
CREATE POLICY qa51_photo_session ON storage.objects AS RESTRICTIVE
 FOR ALL TO authenticated USING (bucket_id <> 'qa44-family-photos' OR (SELECT qa44.session_allowed()))
 WITH CHECK (bucket_id <> 'qa44-family-photos' OR (SELECT qa44.session_allowed()));
COMMIT;
-- N/T: provider session creation/restore guarantees, concurrent in-flight
-- requests, signed URL/cache bypass, writer JWT context, actual schema/grants.
-- No production migration until those boundaries and rollback are verified.
