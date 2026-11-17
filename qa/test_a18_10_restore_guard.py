import unittest
from a18_10_restore_guard import patch, unpatch, BUTTON, PICKER, HANDLER, FILE_INPUT, FINAL_ANCHOR

class RestoreGuardTests(unittest.TestCase):
    def setUp(self):
        self.original = "<main>" + BUTTON + FILE_INPUT + "</main><script>" + PICKER + HANDLER + "if(!storageOk)return notify('no db');}</script>" + FINAL_ANCHOR
    def test_ui_disabled_and_warning_visible(self):
        out = patch(self.original)
        self.assertIn('id="import-json" type="button" disabled', out)
        self.assertIn('role="alert"', out)
        self.assertIn('A→B→A', out)
    def test_both_entrypoints_fail_closed(self):
        out = patch(self.original)
        self.assertIn("onclick=()=>{notify(", out)
        self.assertIn("onchange=async e=>{e.target.value='';notify(", out)
        self.assertIn("return;/* A18-10 fail closed", out)
    def test_file_input_disabled_and_wrapper_guard_installed(self):
        out = patch(self.original)
        self.assertIn('id="import-file" type="file" disabled', out)
        self.assertIn('id="wrong-a18-11-final-restore-guard"', out)
        self.assertIn('file.addEventListener(\'change\',block,true)', out)
    def test_exact_reverse_patch_restores_original(self):
        self.assertEqual(unpatch(patch(self.original)), self.original)
    def test_reapplying_guard_fails_closed(self):
        with self.assertRaises(ValueError):
            patch(patch(self.original))
    def test_no_source_anchor_refuses_change(self):
        with self.assertRaises(ValueError):
            patch(self.original.replace(BUTTON, ""))
    def test_duplicate_anchor_refuses_change(self):
        with self.assertRaises(ValueError):
            patch(self.original + PICKER)
    def test_unrelated_source_preserved(self):
        out = patch(self.original)
        self.assertIn("if(!storageOk)return notify('no db');", out)

if __name__ == '__main__':
    unittest.main()
