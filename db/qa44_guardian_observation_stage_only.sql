-- WRONG-P1 B3: Synthetic guardian observations of existing B2 child attempt IDs.
-- EPHEMERAL PostgreSQL ONLY; not deployed; no real Supabase/A/OAuth.
-- Apply AFTER db/qa44_supabase_staging_rls.sql and db/qa44_child_retry_stage_only.sql.
-- The original full-backup snapshot, storage bucket, and merge preflight are unchanged.
BEGIN;
CREATE TABLE qa44.parent_observation_events (
 family_id uuid NOT NULL REFERENCES qa44.families(family_id),
 guardian_user_id uuid NOT NULL REFERENCES auth.users(id),
 request_id text NOT NULL CHECK (request_id ~ '^[A-Za-z0-9_-]{8,64}$'),
 record_id text NOT NULL CHECK (record_id ~ '^[A-Za-z0-9_-]{1,100}$'),
 child_user_id uuid NOT NULL REFERENCES auth.users(id),
 child_request_id text NOT NULL CHECK (child_request_id ~ '^[A-Za-z0-9_-]{8,64}$'),
 input_sha256 char(64) NOT NULL CHECK(input_sha256 ~ '^[0-9a-f]{64}$'),
 status text NOT NULL CHECK(status IN('not_checked','explained','needs_help')),
 note text NOT NULL DEFAULT '' CHECK(char_length(note)<=500),
 base_revision bigint NOT NULL CHECK(base_revision>=0),
 applied_revision bigint NOT NULL CHECK(applied_revision>base_revision),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(family_id,guardian_user_id,request_id)
);
REVOKE ALL ON qa44.parent_observation_events FROM PUBLIC,anon,authenticated;
ALTER TABLE qa44.parent_observation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa44.parent_observation_events FORCE ROW LEVEL SECURITY;

-- Reuse existing server-only qa44_sync_writer role, never credentials from a browser.
GRANT SELECT ON qa44.child_retry_events,qa44.child_retry_grants TO qa44_sync_writer;
GRANT SELECT,INSERT ON qa44.parent_observation_events TO qa44_sync_writer;
-- No UPDATE or DELETE for this table in qa44_sync_writer.

CREATE POLICY qa44_observe_guardian_approved_child_grant
 ON qa44.child_retry_grants FOR SELECT TO qa44_sync_writer
 USING(role='child' AND consent_verified_at IS NOT NULL AND revoked_at IS NULL
  AND EXISTS(
   SELECT 1 FROM qa44.guardian_memberships m
   WHERE m.family_id=child_retry_grants.family_id
    AND m.guardian_user_id=(SELECT auth.uid()) AND m.role='guardian'
    AND m.verification_source='externally_verified'
    AND m.verified_at IS NOT NULL AND m.consent_verified_at IS NOT NULL
    AND m.revoked_at IS NULL
  ));
CREATE POLICY qa44_observe_guardian_child_attempt
 ON qa44.child_retry_events FOR SELECT TO qa44_sync_writer
 USING(EXISTS(
   SELECT 1 FROM qa44.guardian_memberships m
   WHERE m.family_id=child_retry_events.family_id
    AND m.guardian_user_id=(SELECT auth.uid()) AND m.role='guardian'
    AND m.verification_source='externally_verified'
    AND m.verified_at IS NOT NULL AND m.consent_verified_at IS NOT NULL
    AND m.revoked_at IS NULL
  ));
CREATE POLICY qa44_observation_guardian_read
 ON qa44.parent_observation_events FOR SELECT TO qa44_sync_writer
 USING(guardian_user_id=(SELECT auth.uid()) OR EXISTS(
   SELECT 1 FROM qa44.guardian_memberships m
   WHERE m.family_id=parent_observation_events.family_id
    AND m.guardian_user_id=(SELECT auth.uid()) AND m.role='guardian'
    AND m.verification_source='externally_verified'
    AND m.verified_at IS NOT NULL AND m.consent_verified_at IS NOT NULL
    AND m.revoked_at IS NULL
  ));
-- Any read must be filtered again by a guardian-scoped snapshot at the server
-- boundary; read policy alone MUST NOT reveal data to revoked guardians.
CREATE POLICY qa44_observation_guardian_insert
 ON qa44.parent_observation_events FOR INSERT TO qa44_sync_writer
 WITH CHECK(guardian_user_id=(SELECT auth.uid()) AND EXISTS(
   SELECT 1 FROM qa44.guardian_memberships m
   WHERE m.family_id=parent_observation_events.family_id
    AND m.guardian_user_id=(SELECT auth.uid()) AND m.role='guardian'
    AND m.verification_source='externally_verified'
    AND m.verified_at IS NOT NULL AND m.consent_verified_at IS NOT NULL
    AND m.revoked_at IS NULL
  ));
COMMIT;
