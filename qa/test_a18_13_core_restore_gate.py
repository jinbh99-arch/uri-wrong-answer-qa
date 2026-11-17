import unittest
from a18_13_core_restore_gate import (patch,unpatch,ATOMIC_ANCHOR,ATOMIC_GUARD,PROBE_ANCHOR,PROBE_HOOK)

class A1813CoreGateTest(unittest.TestCase):
 def setUp(self):
  self.source='start\n'+ATOMIC_ANCHOR+'return new Promise()\n'+PROBE_ANCHOR+'end'
 def test_apply_once(self):
  assert patch(self.source).count("A1813_RESTORE_DISABLED")==1
 def test_same_named_handle_guards(self):
  assert 'targetDb.name===DB' in patch(self.source)
 def test_idb_pre_transaction(self):
  assert patch(self.source).index('A1813_RESTORE_DISABLED')<patch(self.source).index('return new Promise()')
 def test_primary_data_not_cleared_on_failure(self):
  assert "return Promise.reject(" in patch(self.source)
 def test_exposes_core_probes_only_for_qa(self):
  s=patch(self.source); assert "__wrongA1813Probe" in s and 'directPhoto' in s and 'directClear' in s
 def test_reverse_bytes(self):
  assert unpatch(patch(self.source))==self.source
 def test_repeated_application_fails(self):
  with self.assertRaises(ValueError): patch(patch(self.source))
 def test_corrupt_or_missing_hook_reversal_fails(self):
  with self.assertRaises(ValueError): unpatch(patch(self.source).replace("directClear","missingClear"))
 def test_missing_base_anchor_fails(self):
  with self.assertRaises(ValueError): patch(self.source.replace(ATOMIC_ANCHOR,''))
 if __name__=='__main__': unittest.main()
