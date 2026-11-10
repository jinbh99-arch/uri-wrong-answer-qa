-- WRONG-P7: disposable PostgreSQL16 authorization fixture for restored read only.
-- NO migration to qa44, no credential issuance, no operating schema changes.
BEGIN;
DO $$
BEGIN
 IF current_database()<>'qa39_ci' THEN RAISE EXCEPTION 'WRONG_P7_SYNTHETIC_DB_ONLY'; END IF;
 IF to_regclass('wrong_p6_synthetic.family_state') IS NULL THEN
  RAISE EXCEPTION 'P6_SYNTHETIC_RESTORE_REQUIRED';
 END IF;
END $$;
CREATE SCHEMA wrong_p7_synthetic;
REVOKE ALL ON SCHEMA wrong_p7_synthetic FROM PUBLIC;
CREATE TABLE wrong_p7_synthetic.guardian_permissions(
 family_id uuid NOT NULL REFERENCES wrong_p6_synthetic.family_state(family_id),
 guardian_user_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN('guardian','viewer')),
 externally_verified boolean NOT NULL DEFAULT false,
 consent_verified_at timestamptz,
 revoked_at timestamptz,
 PRIMARY KEY(family_id,guardian_user_id)
);
CREATE TABLE wrong_p7_synthetic.child_grants(
 family_id uuid NOT NULL REFERENCES wrong_p6_synthetic.family_state(family_id),
 child_user_id uuid NOT NULL,
 record_id text NOT NULL CHECK(record_id~'^[A-Za-z0-9_-]{1,100}$'),
 consent_verified_at timestamptz,
 revoked_at timestamptz,
 PRIMARY KEY(family_id,child_user_id,record_id)
);
REVOKE ALL ON ALL TABLES IN SCHEMA wrong_p7_synthetic FROM PUBLIC;
COMMIT;
