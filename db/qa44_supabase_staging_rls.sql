-- QA44 Supabase FREE schema source; first real empty-project application in QA46 (2026-11-08).
-- CI mocks auth/storage in ephemeral PG; QA46 also verified migration in real Supabase PG17.
-- The owner must VERIFY legal-guardian relationship + consent independently;
-- neither OAuth sign-in nor an email address is legal guardian proof.
BEGIN;
CREATE SCHEMA IF NOT EXISTS qa44;
REVOKE ALL ON SCHEMA qa44 FROM PUBLIC;
CREATE TABLE qa44.families (
 family_id uuid PRIMARY KEY,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE qa44.guardian_memberships (
 family_id uuid NOT NULL REFERENCES qa44.families(family_id) ON DELETE CASCADE,
 guardian_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('guardian','viewer')),
 verification_source text NOT NULL DEFAULT 'pending'
  CHECK (verification_source IN ('pending','externally_verified')),
 verified_at timestamptz,
 consent_verified_at timestamptz,
 revoked_at timestamptz,
 PRIMARY KEY(family_id,guardian_user_id),
 CHECK (verification_source <> 'externally_verified'
    OR (verified_at IS NOT NULL AND consent_verified_at IS NOT NULL))
);
CREATE INDEX qa44_membership_uid ON qa44.guardian_memberships(guardian_user_id,family_id);
CREATE TABLE qa44.family_snapshots (
 family_id uuid PRIMARY KEY REFERENCES qa44.families(family_id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 0 CHECK (revision>=0),
 snapshot_text text,
 content_sha256 char(64),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((snapshot_text IS NULL AND content_sha256 IS NULL)
  OR (snapshot_text IS NOT NULL AND content_sha256 ~ '^[0-9a-f]{64}$'))
);
REVOKE ALL ON ALL TABLES IN SCHEMA qa44 FROM PUBLIC, anon, authenticated;
ALTER TABLE qa44.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa44.families FORCE ROW LEVEL SECURITY;
ALTER TABLE qa44.guardian_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa44.guardian_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE qa44.family_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa44.family_snapshots FORCE ROW LEVEL SECURITY;

-- A user can see ONLY their own membership record. NO client provisioning
-- grants whatsoever; admin verification is separate from Supabase Auth.
CREATE POLICY qa44_my_verified_membership
 ON qa44.guardian_memberships FOR SELECT TO authenticated
 USING (auth.uid() IS NOT NULL
    AND guardian_user_id=(SELECT auth.uid())
    AND role='guardian'
    AND verification_source='externally_verified'
    AND verified_at IS NOT NULL AND consent_verified_at IS NOT NULL
    AND revoked_at IS NULL);

CREATE POLICY qa44_guardian_read_only_snapshot
 ON qa44.family_snapshots FOR SELECT TO authenticated
 USING ((SELECT auth.uid()) IS NOT NULL AND EXISTS (
  SELECT 1 FROM qa44.guardian_memberships m
  WHERE m.family_id=family_snapshots.family_id
   AND m.guardian_user_id=(SELECT auth.uid())
   AND m.role='guardian'
   AND m.verification_source='externally_verified'
   AND m.verified_at IS NOT NULL AND m.consent_verified_at IS NOT NULL
   AND m.revoked_at IS NULL
 ));

-- Must also explicitly deny unverified/unauthenticated roles at SQL grant
-- level. NO client UPDATE/DELETE/INSERT to family snapshots.
GRANT USAGE ON SCHEMA qa44 TO authenticated;
GRANT SELECT ON qa44.guardian_memberships,qa44.family_snapshots TO authenticated;

-- SERVER-ONLY update role. Do not grant this role to anonymous visitors,
-- authenticated clients, service-role JS in the browser, or public APIs.
-- The actual backend must use a separate private DB login with this role and
-- set the JWT subject GUC ONLY AFTER server-side Supabase getUser(token).
CREATE ROLE qa44_sync_writer NOLOGIN;
GRANT USAGE ON SCHEMA qa44,auth TO qa44_sync_writer;
GRANT SELECT ON qa44.guardian_memberships,qa44.family_snapshots TO qa44_sync_writer;
GRANT UPDATE(revision,snapshot_text,content_sha256,updated_at)
 ON qa44.family_snapshots TO qa44_sync_writer;
CREATE POLICY qa44_writer_read_membership
 ON qa44.guardian_memberships FOR SELECT TO qa44_sync_writer
 USING (auth.uid() IS NOT NULL AND guardian_user_id=(SELECT auth.uid())
  AND role='guardian' AND verification_source='externally_verified'
  AND verified_at IS NOT NULL AND consent_verified_at IS NOT NULL
  AND revoked_at IS NULL);
CREATE POLICY qa44_writer_read_snapshot
 ON qa44.family_snapshots FOR SELECT TO qa44_sync_writer
 USING ((SELECT auth.uid()) IS NOT NULL AND EXISTS (
  SELECT 1 FROM qa44.guardian_memberships m
  WHERE m.family_id=family_snapshots.family_id
   AND m.guardian_user_id=(SELECT auth.uid()) AND m.role='guardian'
   AND m.verification_source='externally_verified'
   AND m.verified_at IS NOT NULL AND m.consent_verified_at IS NOT NULL
   AND m.revoked_at IS NULL
 ));
CREATE POLICY qa44_writer_update_snapshot
 ON qa44.family_snapshots FOR UPDATE TO qa44_sync_writer
 USING ((SELECT auth.uid()) IS NOT NULL AND EXISTS (
  SELECT 1 FROM qa44.guardian_memberships m
  WHERE m.family_id=family_snapshots.family_id
   AND m.guardian_user_id=(SELECT auth.uid()) AND m.role='guardian'
   AND m.verification_source='externally_verified'
   AND m.verified_at IS NOT NULL AND m.consent_verified_at IS NOT NULL
   AND m.revoked_at IS NULL
 )) WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND EXISTS (
  SELECT 1 FROM qa44.guardian_memberships m
  WHERE m.family_id=family_snapshots.family_id
   AND m.guardian_user_id=(SELECT auth.uid()) AND m.role='guardian'
   AND m.verification_source='externally_verified'
   AND m.verified_at IS NOT NULL AND m.consent_verified_at IS NOT NULL
   AND m.revoked_at IS NULL
 ));

-- Supabase Storage. Storage operations remain private and family-scoped.
-- Uploads are insert-only: no client overwrite/delete to defeat backups or
-- delete a guardian's shared objects. Server validator is still REQUIRED
-- before actual rollout to ensure photos correspond to verified app records.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES ('qa44-family-photos','qa44-family-photos',false,1048576,
   ARRAY['image/png','image/jpeg','image/webp'])
 ON CONFLICT (id) DO NOTHING;

-- Format familyUUID/recordID/randomUUID.png; max 1MiB, no public access.
-- Never allow full URL, querystring, ../ or nested extra path segments.
CREATE POLICY qa44_private_photo_read
 ON storage.objects FOR SELECT TO authenticated
 USING (bucket_id='qa44-family-photos' AND
   name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[A-Za-z0-9_-]{1,100}/[0-9a-f]{8}-[0-9a-f-]{27}\.(png|jpg|webp)$'
   AND EXISTS (
     SELECT 1 FROM qa44.guardian_memberships m
     WHERE m.family_id::text=split_part(name,'/',1)
       AND m.guardian_user_id=(SELECT auth.uid())
       AND m.role='guardian'
       AND m.verification_source='externally_verified'
       AND m.verified_at IS NOT NULL AND m.consent_verified_at IS NOT NULL
       AND m.revoked_at IS NULL
  ));
CREATE POLICY qa44_private_photo_insert
 ON storage.objects FOR INSERT TO authenticated
 WITH CHECK (bucket_id='qa44-family-photos' AND
   name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[A-Za-z0-9_-]{1,100}/[0-9a-f]{8}-[0-9a-f-]{27}\.(png|jpg|webp)$'
   AND EXISTS (
     SELECT 1 FROM qa44.guardian_memberships m
     WHERE m.family_id::text=split_part(name,'/',1)
       AND m.guardian_user_id=(SELECT auth.uid())
       AND m.role='guardian'
       AND m.verification_source='externally_verified'
       AND m.verified_at IS NOT NULL AND m.consent_verified_at IS NOT NULL
       AND m.revoked_at IS NULL
  ));
-- Existing storage.objects grants/policies are managed by Supabase itself.
-- Inspect those at deploy time, including UPDATE/DELETE/owner loopholes.
-- This migration does NOT grant any extra storage privileges.
COMMIT;
