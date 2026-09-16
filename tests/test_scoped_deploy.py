import importlib.util, tempfile, unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location('scoped',Path(__file__).parents[1]/'scripts/deploy-scoped.py')
scoped=importlib.util.module_from_spec(spec);spec.loader.exec_module(scoped)

class ScopedReleaseTests(unittest.TestCase):
    def test_apply_preserves_unlisted_files_and_rollback_restores_original_tree(self):
        with tempfile.TemporaryDirectory() as directory:
            folder=Path(directory);root=folder/'site';payload=folder/'payload';root.mkdir();payload.mkdir()
            (root/'index.html').write_text('five');(root/'unrelated.json').write_text('preserve')
            (payload/'index.html').write_text('seven');(payload/'demo6.html').write_text('new demo')
            manifest={'root':str(root),'sourceCommit':'test','before':scoped.inventory(root),'files':scoped.inventory(payload)}
            self.assertEqual(scoped.release('check',manifest,payload,folder/'backup')['status'],'ready')
            self.assertFalse((folder/'backup').exists())
            self.assertEqual(scoped.release('apply',manifest,payload,folder/'backup')['untouchedVerified'],1)
            self.assertEqual((root/'unrelated.json').read_text(),'preserve')
            self.assertEqual(scoped.release('rollback',manifest,payload,folder/'backup')['status'],'rolled back')
            self.assertEqual(scoped.inventory(root),manifest['before'])

    def test_drift_and_path_escape_refuse_before_any_write(self):
        with tempfile.TemporaryDirectory() as directory:
            folder=Path(directory);root=folder/'site';payload=folder/'payload';root.mkdir();payload.mkdir()
            (root/'index.html').write_text('five');(payload/'index.html').write_text('seven')
            manifest={'root':str(root),'sourceCommit':'test','before':scoped.inventory(root),'files':scoped.inventory(payload)}
            (root/'index.html').write_text('concurrent change')
            with self.assertRaises(AssertionError):scoped.release('apply',manifest,payload,folder/'backup')
            self.assertEqual((root/'index.html').read_text(),'concurrent change')
            self.assertFalse((folder/'backup').exists())
            with self.assertRaises(RuntimeError):scoped.safe_file(root,'../outside')

if __name__=='__main__': unittest.main()
