-- WRONG-P6: EPHEMERAL synthetic PostgreSQL16 restore fixtures ONLY.
-- Not a migration for qa44 or production Supabase. No browser/IdP or live data.
-- This script aborts outside the disposable CI database named qa39_ci.
BEGIN;
DO $$ BEGIN
 IF current_database() <> 'qa39_ci' THEN
  RAISE EXCEPTION 'WRONG_P6_EPHEMERAL_DB_ONLY';
 END IF;
END $$;
CREATE SCHEMA wrong_p6_synthetic;
REVOKE ALL ON SCHEMA wrong_p6_synthetic FROM PUBLIC;

CREATE TABLE wrong_p6_synthetic.family_state (
 family_id uuid PRIMARY KEY,
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 snapshot_text text,
 content_sha256 char(64),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((snapshot_text IS NULL AND content_sha256 IS NULL)
    OR (snapshot_text IS NOT NULL AND content_sha256 ~ '^[a-f0-9]{64}$'))
);
CREATE TABLE wrong_p6_synthetic.child_retries (
 family_id uuid NOT NULL REFERENCES wrong_p6_synthetic.family_state(family_id),
 child_user_id text NOT NULL,
 request_id text NOT NULL,
 record_id text NOT NULL,
 event_text text NOT NULL,
 applied_revision bigint NOT NULL CHECK(applied_revision>=2),
 PRIMARY KEY (family_id,child_user_id,request_id),
 UNIQUE (family_id,applied_revision)
);
CREATE TABLE wrong_p6_synthetic.parent_observations (
 family_id uuid NOT NULL REFERENCES wrong_p6_synthetic.family_state(family_id),
 guardian_user_id text NOT NULL,
 request_id text NOT NULL,
 child_user_id text NOT NULL,
 child_request_id text NOT NULL,
 record_id text NOT NULL,
 event_text text NOT NULL,
 applied_revision bigint NOT NULL CHECK(applied_revision>=2),
 PRIMARY KEY (family_id,guardian_user_id,request_id),
 UNIQUE (family_id,applied_revision),
 FOREIGN KEY(family_id,child_user_id,child_request_id)
  REFERENCES wrong_p6_synthetic.child_retries(family_id,child_user_id,request_id)
);
CREATE TABLE wrong_p6_synthetic.restore_receipts (
 family_id uuid NOT NULL REFERENCES wrong_p6_synthetic.family_state(family_id),
 request_id text NOT NULL,
 bundle_sha256 char(64) NOT NULL CHECK(bundle_sha256 ~ '^[a-f0-9]{64}$'),
 imported_revision bigint NOT NULL CHECK(imported_revision>=1),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(family_id,request_id)
);
REVOKE ALL ON ALL TABLES IN SCHEMA wrong_p6_synthetic FROM PUBLIC;
COMMIT;
