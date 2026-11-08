-- QA39 G15: PostgreSQL tenant-scoped snapshot prototype, not deployed.
-- Run only as DB owner on an ISOLATED QA database after creating a limited
-- qa39_app role. Role credentials never belong in a public source repository.
-- Guardian approval is provisioned by a privileged, independently verified
-- service, NOT by self-submitted family ID or a public signup endpoint.
BEGIN;
CREATE SCHEMA qa39;
REVOKE ALL ON SCHEMA qa39 FROM PUBLIC;
CREATE TABLE qa39.families (
 family_id uuid PRIMARY KEY,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE qa39.guardian_memberships (
 family_id uuid NOT NULL REFERENCES qa39.families(family_id) ON DELETE CASCADE,
 principal_id text NOT NULL CHECK (length(principal_id) BETWEEN 4 AND 160),
 role text NOT NULL CHECK (role IN ('guardian', 'viewer')),
 verified_at timestamptz,
 revoked_at timestamptz,
 PRIMARY KEY(family_id, principal_id)
);
CREATE INDEX qa39_guardian_by_principal ON qa39.guardian_memberships(principal_id,family_id);
CREATE TABLE qa39.family_snapshots (
 family_id uuid PRIMARY KEY REFERENCES qa39.families(family_id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 0 CHECK (revision>=0),
 -- TEXT intentionally preserves exact JSON/photo base64 bytes and key order.
 snapshot_text text,
 content_sha256 char(64),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((snapshot_text IS NULL AND content_sha256 IS NULL)
     OR (snapshot_text IS NOT NULL AND content_sha256 ~ '^[0-9a-f]{64}$'))
);
REVOKE ALL ON ALL TABLES IN SCHEMA qa39 FROM PUBLIC;
ALTER TABLE qa39.guardian_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa39.guardian_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE qa39.family_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa39.family_snapshots FORCE ROW LEVEL SECURITY;
-- The connection must be owned by a trusted server. A client with SQL access
-- can forge current_setting(), so NEVER expose DB credentials to browsers.
CREATE POLICY qa39_member_read ON qa39.guardian_memberships
 FOR SELECT TO qa39_app USING (
  principal_id=current_setting('qa39.principal_id',true)
  AND verified_at IS NOT NULL AND revoked_at IS NULL
 );
CREATE POLICY qa39_snapshot_guardian_read ON qa39.family_snapshots
 FOR SELECT TO qa39_app USING (
  EXISTS (
   SELECT 1 FROM qa39.guardian_memberships m
   WHERE m.family_id=qa39.family_snapshots.family_id
     AND m.principal_id=current_setting('qa39.principal_id',true)
     AND m.role='guardian' AND m.verified_at IS NOT NULL
     AND m.revoked_at IS NULL
  )
 );
CREATE POLICY qa39_snapshot_guardian_update ON qa39.family_snapshots
 FOR UPDATE TO qa39_app USING (
  EXISTS (
   SELECT 1 FROM qa39.guardian_memberships m
   WHERE m.family_id=qa39.family_snapshots.family_id
     AND m.principal_id=current_setting('qa39.principal_id',true)
     AND m.role='guardian' AND m.verified_at IS NOT NULL
     AND m.revoked_at IS NULL
  )
 ) WITH CHECK (
  EXISTS (
   SELECT 1 FROM qa39.guardian_memberships m
   WHERE m.family_id=qa39.family_snapshots.family_id
     AND m.principal_id=current_setting('qa39.principal_id',true)
     AND m.role='guardian' AND m.verified_at IS NOT NULL
     AND m.revoked_at IS NULL
  )
 );
GRANT USAGE ON SCHEMA qa39 TO qa39_app;
GRANT SELECT ON qa39.guardian_memberships TO qa39_app;
GRANT SELECT ON qa39.family_snapshots TO qa39_app;
GRANT UPDATE(revision,snapshot_text,content_sha256,updated_at)
 ON qa39.family_snapshots TO qa39_app;
-- No INSERT/DELETE rights, no grant on families, no provisioning by app role.
COMMIT;
