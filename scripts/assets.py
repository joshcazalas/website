#!/usr/bin/env python3
"""Package and verify the exact runtime assets used by the website."""

import argparse
import gzip
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parent.parent
INPUTS = ("src/asset-catalog.json", "src/auxide-samples.json", "scripts/import-assets.mjs")
ICONS = ("iron-plate.png", "iron-gear-wheel.png", "processing-unit.png", "programmable-speaker.png")
FONTS = ("NotoSans-Regular.ttf", "NotoSans-Bold.ttf", "NotoMono-Regular.ttf")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read_json(path):
    return json.loads(Path(path).read_text())


def write_json(path, value):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def inventory(directory):
    result = {}
    for path in sorted(Path(directory).rglob("*")):
        if path.is_symlink():
            raise ValueError(f"Symlinks are not allowed: {path}")
        if path.is_file():
            data = path.read_bytes()
            result[path.relative_to(directory).as_posix()] = {"sha256": digest(data), "size": len(data)}
    return result


def archive_files(directory, names, output):
    """Stable archives: sorted paths, fixed modes, no host names or timestamps."""
    with Path(output).open("wb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode="w", format=tarfile.USTAR_FORMAT) as archive:
                for name in sorted(names):
                    path = Path(directory) / name
                    if path.is_symlink() or not path.is_file():
                        raise ValueError(f"Expected a regular file: {name}")
                    data = path.read_bytes()
                    member = tarfile.TarInfo(name)
                    member.size = len(data)
                    member.mode = 0o644
                    archive.addfile(member, io.BytesIO(data))


def unpack_verified(archive_path, expected, destination):
    """Reject traversal, links, duplicates, missing files, and unexpected payloads."""
    seen = set()
    with tarfile.open(archive_path, "r:gz") as archive:
        for member in archive:
            name = member.name
            path = PurePosixPath(name)
            if (not member.isfile() or path.is_absolute() or ".." in path.parts
                    or str(path) != name or name not in expected or name in seen):
                raise ValueError(f"Unexpected archive member: {name}")
            if member.size != expected[name]["size"]:
                raise ValueError(f"Incorrect file size: {name}")
            data = archive.extractfile(member).read()
            if digest(data) != expected[name]["sha256"]:
                raise ValueError(f"Incorrect file checksum: {name}")
            target = Path(destination) / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            seen.add(name)
    if seen != set(expected):
        raise ValueError(f"Missing archive members: {sorted(set(expected) - seen)}")


def check_inputs(lock):
    if lock.get("schema") != 1:
        raise ValueError("Unsupported asset lock schema")
    for name in INPUTS:
        if lock["inputs"].get(name) != digest((ROOT / name).read_bytes()):
            raise ValueError(f"{name} changed; regenerate and publish a new asset pack")


def required_files(directory):
    pages = read_json(Path(directory) / "packed/manifest.json")["pages"]
    if not isinstance(pages, int) or not 1 <= pages <= 32:
        raise ValueError("Invalid atlas page count")
    return sorted([
        "packed/manifest.json",
        *(f"packed/atlas-{i}.png" for i in range(pages)),
        *(f"icons/{name}" for name in ICONS),
        *(f"fonts/{name}" for name in FONTS),
        *(f"sound/programmable-speaker/{name}" for name in read_json(ROOT / "src/auxide-samples.json").values()),
    ])


def verify_installed(lock, directory):
    check_inputs(lock)
    if required_files(directory) != sorted(lock["files"]):
        raise ValueError("Asset lock does not match required runtime files")
    for name, expected in lock["files"].items():
        path = Path(directory) / name
        if path.is_symlink() or not path.is_file():
            raise ValueError(f"Missing regular asset file: {name}")
        data = path.read_bytes()
        if len(data) != expected["size"] or digest(data) != expected["sha256"]:
            raise ValueError(f"Asset differs from the lock: {name}")


def pack(args):
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]+", args.tag):
        raise ValueError("Invalid asset tag")
    source = ROOT / "public/factorio"
    names = required_files(source)
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    archive = output / "factorio-runtime.tar.gz"
    archive_files(source, names, archive)
    files = {name: {"sha256": digest((source / name).read_bytes()), "size": (source / name).stat().st_size} for name in names}
    lock = {
        "schema": 1, "repository": args.repository, "tag": args.tag,
        "archive": archive.name, "sha256": digest(archive.read_bytes()), "size": archive.stat().st_size,
        "factorio_version": args.game_version,
        "inputs": {name: digest((ROOT / name).read_bytes()) for name in INPUTS},
        "files": files,
    }
    write_json(args.lock, lock)
    write_json(output / "assets.lock.json", lock)
    print(f"Packed {len(names)} runtime files into {archive} ({archive.stat().st_size:,} bytes)")


def fetch(args):
    lock = read_json(args.lock)
    check_inputs(lock)
    destination = ROOT / "public/factorio"
    destination.parent.mkdir(parents=True, exist_ok=True)
    # Stage beside the destination so a failed download never damages local assets.
    with tempfile.TemporaryDirectory(prefix=".factorio-stage-", dir=destination.parent) as work:
        work = Path(work)
        archive = Path(args.archive).resolve() if args.archive else work / lock["archive"]
        if not args.archive:
            repo = lock["repository"]
            if repo != "joshcazalas/website-assets":
                raise ValueError("Unexpected asset repository")
            result = subprocess.run(["gh", "api", f"repos/{repo}/releases/tags/{lock['tag']}"], check=True, capture_output=True, text=True)
            release = json.loads(result.stdout)
            if release["draft"] or release["prerelease"] or not release.get("immutable"):
                raise ValueError("The asset release must be published and immutable")
            matches = [asset for asset in release["assets"] if asset["name"] == lock["archive"]]
            if len(matches) != 1 or matches[0]["size"] != lock["size"]:
                raise ValueError("Asset release has no matching archive")
            asset = matches[0]
            if asset.get("digest") != "sha256:" + lock["sha256"]:
                raise ValueError("GitHub's asset digest differs from the pinned digest")
            with archive.open("wb") as output:
                subprocess.run(["gh", "api", "-H", "Accept: application/octet-stream", f"repos/{repo}/releases/assets/{asset['id']}"], stdout=output, check=True)
        if archive.stat().st_size != lock["size"] or digest(archive.read_bytes()) != lock["sha256"]:
            raise ValueError("Asset archive checksum or size mismatch")
        staged = work / "files"
        staged.mkdir()
        unpack_verified(archive, lock["files"], staged)
        verify_installed(lock, staged)
        # Preserve the existing imported originals; builds include only the locked runtime set.
        for name in lock["files"]:
            target = destination / name
            target.parent.mkdir(parents=True, exist_ok=True)
            if target.parent.resolve().is_relative_to(destination.resolve()) is False:
                raise ValueError("Asset destination escapes its root")
            os.replace(staged / name, target)
    print(f"Installed verified assets: {lock['tag']}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lock", default=str(ROOT / "assets.lock.json"))
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("pack")
    create.add_argument("--repository", default="joshcazalas/website-assets")
    create.add_argument("--tag", required=True)
    create.add_argument("--game-version", required=True)
    create.add_argument("--output", default=str(ROOT / ".local/asset-packs"))
    create.set_defaults(run=pack)
    download = commands.add_parser("fetch")
    download.add_argument("--archive", help="Use a local pack, with identical checksum verification")
    download.set_defaults(run=fetch)
    verify = commands.add_parser("verify")
    verify.set_defaults(run=lambda args: verify_installed(read_json(args.lock), ROOT / "public/factorio"))
    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()
