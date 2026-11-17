import unittest
from a18_10_restore_guard import patch, BUTTON, PICKER, HANDLER

class RestoreGuardTests(unittest.TestCase):
    def setUp(self):
        self.original = "<main>" + BUTTON + "</main><script>" + PICKER + HANDLER + "if(!storageOk)return notify('no db');}</script>"
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
