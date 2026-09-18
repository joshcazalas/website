import io
from pathlib import Path
import tarfile
import tempfile
import unittest
from assets import archive_files, inventory, unpack_verified


class AssetArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "source"
        self.source.mkdir()
        (self.source / "sprite.png").write_bytes(b"test sprite")
        self.expected = inventory(self.source)

    def malicious_archive(self, name, kind=tarfile.REGTYPE, data=b"test sprite"):
        archive = self.root / "bad.tar.gz"
        with tarfile.open(archive, "w:gz") as output:
            member = tarfile.TarInfo(name)
            member.type = kind
            member.linkname = "../outside"
            member.size = len(data) if kind == tarfile.REGTYPE else 0
            output.addfile(member, io.BytesIO(data))
        return archive

    def test_reproducible_round_trip(self):
        first, second = self.root / "one.tar.gz", self.root / "two.tar.gz"
        archive_files(self.source, self.expected, first)
        (self.source / "sprite.png").touch()
        archive_files(self.source, self.expected, second)
        self.assertEqual(first.read_bytes(), second.read_bytes())
        target = self.root / "restored"
        unpack_verified(first, self.expected, target)
        self.assertEqual(inventory(target), self.expected)

    def test_rejects_traversal_absolute_paths_and_unknown_files(self):
        for name in ("../sprite.png", "/sprite.png", "extra.png", "a/../sprite.png"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                unpack_verified(self.malicious_archive(name), self.expected, self.root / "out")
        self.assertFalse((self.root / "sprite.png").exists())

    def test_rejects_links(self):
        for kind in (tarfile.SYMTYPE, tarfile.LNKTYPE):
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                unpack_verified(self.malicious_archive("sprite.png", kind), self.expected, self.root / "out")

    def test_rejects_corruption_and_missing_files(self):
        with self.assertRaisesRegex(ValueError, "checksum"):
            unpack_verified(self.malicious_archive("sprite.png", data=b"bad! sprite"), self.expected, self.root / "out")
        archive = self.root / "empty.tar.gz"
        with tarfile.open(archive, "w:gz"):
            pass
        with self.assertRaisesRegex(ValueError, "Missing"):
            unpack_verified(archive, self.expected, self.root / "out")

    def test_rejects_duplicate_members(self):
        archive = self.root / "duplicates.tar.gz"
        with tarfile.open(archive, "w:gz") as output:
            for _ in range(2):
                member = tarfile.TarInfo("sprite.png")
                member.size = 11
                output.addfile(member, io.BytesIO(b"test sprite"))
        with self.assertRaisesRegex(ValueError, "Unexpected"):
            unpack_verified(archive, self.expected, self.root / "out")


if __name__ == "__main__":
    unittest.main()
