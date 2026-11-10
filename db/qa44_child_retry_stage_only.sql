-- QA44 CHILD RETRY ONLY: isolated ephemeral PostgreSQL fixture, NOT a deployed migration.
-- Apply ONLY after db/qa44_supabase_staging_rls.sql inside a local synthetic test DB.
-- Existing guardian-only backup RLS / storage policies remain unmodified.
BEGIN;
CREATE TABLE qa44.child_retry_grants (
 family_id uuid NOT NULL REFERENCES qa44.families(family_id),
 child_user_id uuid NOT NULL REFERENCES auth.users(id),
 record_id text NOT NULL CHECK (record_id ~ '^[A-Za-z0-9_-]{1,100}$'),
 role text NOT NULL DEFAULT 'child' CHECK(role='child'),
 consent_verified_at timestamptz,
 revoked_at timestamptz,
 PRIMARY KEY (family_id,child_user_id,record_id)
);
CREATE TABLE qa44.child_retry_events (
 family_id uuid NOT NULL REFERENCES qa44.families(family_id),
 child_user_id uuid NOT NULL REFERENCES auth.users(id),
 request_id text NOT NULL CHECK(request_id ~ '^[A-Za-z0-9_-]{8,64}$'),
 record_id text NOT NULL,
 input_sha256 char(64) NOT NULL,
 attempt_json jsonb NOT NULL,
 base_revision bigint NOT NULL,
 applied_revision bigint NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(family_id,child_user_id,request_id),
 CHECK (input_sha256 ~ '^[0-9a-f]{64}$')
);
REVOKE ALL ON qa44.child_retry_grants,qa44.child_retry_events FROM PUBLIC,anon,authenticated;
ALTER TABLE qa44.child_retry_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa44.child_retry_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE qa44.child_retry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa44.child_retry_events FORCE ROW LEVEL SECURITY;
CREATE ROLE qa44_child_retry_writer NOLOGIN;
GRANT USAGE ON SCHEMA qa44,auth TO qa44_child_retry_writer;
GRANT SELECT ON qa44.child_retry_grants,qa44.child_retry_events,
 qa44.family_snapshots,qa44.guardian_memberships TO qa44_child_retry_writer;
GRANT INSERT ON qa44.child_retry_events TO qa44_child_retry_writer;
GRANT UPDATE(revision,snapshot_text,content_sha256,updated_at)
 ON qa44.family_snapshots TO qa44_child_retry_writer;
-- The following RLS policies cannot replace the server's per-record projection,
-- strict append-only input validation and version/CAS checks.
CREATE POLICY qa44_child_guardian_status
 ON qa44.guardian_memberships FOR SELECT TO qa44_child_retry_writer
 USING(role='guardian' AND verification_source='externally_verified'
  AND verified_at IS NOT NULL AND consent_verified_at IS NOT NULL AND revoked_at IS NULL);
CREATE POLICY qa44_child_grant_read
 ON qa44.child_retry_grants FOR SELECT TO qa44_child_retry_writer
 USING(child_user_id=(SELECT auth.uid()) AND role='child'
  AND consent_verified_at IS NOT NULL AND revoked_at IS NULL
  AND EXISTS (
    SELECT 1 FROM qa44.guardian_memberships m
    WHERE m.family_id=child_retry_grants.family_id AND m.role='guardian'
     AND m.verification_source='externally_verified' AND m.verified_at IS NOT NULL
     AND m.consent_verified_at IS NOT NULL AND m.revoked_at IS NULL
  ));
CREATE POLICY qa44_child_snapshot_read
 ON qa44.family_snapshots FOR SELECT TO qa44_child_retry_writer
 USING((SELECT auth.uid()) IS NOT NULL AND EXISTS(
   SELECT 1 FROM qa44.child_retry_grants g
   WHERE g.family_id=family_snapshots.family_id AND g.child_user_id=(SELECT auth.uid())
     AND g.role='child' AND g.consent_verified_at IS NOT NULL AND g.revoked_at IS NULL
 ));
CREATE POLICY qa44_child_snapshot_update
 ON qa44.family_snapshots FOR UPDATE TO qa44_child_retry_writer
 USING((SELECT auth.uid()) IS NOT NULL AND EXISTS(
   SELECT 1 FROM qa44.child_retry_grants g
   WHERE g.family_id=family_snapshots.family_id AND g.child_user_id=(SELECT auth.uid())
     AND g.role='child' AND g.consent_verified_at IS NOT NULL AND g.revoked_at IS NULL
 ))
 WITH CHECK((SELECT auth.uid()) IS NOT NULL AND EXISTS(
   SELECT 1 FROM qa44.child_retry_grants g
   WHERE g.family_id=family_snapshots.family_id AND g.child_user_id=(SELECT auth.uid())
     AND g.role='child' AND g.consent_verified_at IS NOT NULL AND g.revoked_at IS NULL
 ));
CREATE POLICY qa44_child_event_read
 ON qa44.child_retry_events FOR SELECT TO qa44_child_retry_writer
 USING(child_user_id=(SELECT auth.uid()) AND EXISTS(
   SELECT 1 FROM qa44.child_retry_grants g
   WHERE g.family_id=child_retry_events.family_id
    AND g.child_user_id=child_retry_events.child_user_id
    AND g.record_id=child_retry_events.record_id
    AND g.role='child' AND g.consent_verified_at IS NOT NULL AND g.revoked_at IS NULL
 ));
CREATE POLICY qa44_child_event_insert
 ON qa44.child_retry_events FOR INSERT TO qa44_child_retry_writer
 WITH CHECK(child_user_id=(SELECT auth.uid()) AND EXISTS(
   SELECT 1 FROM qa44.child_retry_grants g
   WHERE g.family_id=child_retry_events.family_id
    AND g.child_user_id=child_retry_events.child_user_id
    AND g.record_id=child_retry_events.record_id
    AND g.role='child' AND g.consent_verified_at IS NOT NULL AND g.revoked_at IS NULL
 ));
COMMIT;
