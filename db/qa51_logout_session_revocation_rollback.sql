-- QA51 emergency rollback candidate: fail closed, retain all revocations.
-- Disable Edge endpoints separately; never restore QA47 unguarded access.
BEGIN;
CREATE POLICY qa51_emergency_membership_deny ON qa44.guardian_memberships AS RESTRICTIVE
 FOR ALL TO authenticated,qa44_sync_writer USING (false) WITH CHECK (false);
CREATE POLICY qa51_emergency_snapshot_deny ON qa44.family_snapshots AS RESTRICTIVE
 FOR ALL TO authenticated,qa44_sync_writer USING (false) WITH CHECK (false);
CREATE POLICY qa51_emergency_family_deny ON qa44.families AS RESTRICTIVE
 FOR ALL TO authenticated,qa44_sync_writer USING (false) WITH CHECK (false);
CREATE POLICY qa51_emergency_photo_deny ON storage.objects AS RESTRICTIVE
 FOR ALL TO authenticated USING (bucket_id <> 'qa44-family-photos')
 WITH CHECK (bucket_id <> 'qa44-family-photos');
REVOKE EXECUTE ON FUNCTION public.qa47_my_verified_family_ids() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.qa51_revoke_session(uuid,boolean) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION qa44.revoke_current_session(uuid,boolean) FROM PUBLIC,anon,authenticated;
-- Keep session gate, tombstones, epoch and operation receipts intact.
COMMIT;
-- Reopening requires separate reviewed migration and verification.
-- Existing signed URLs, cached responses and service-role paths require
-- separate containment; this SQL does not invalidate those.
