#!/usr/bin/env python3
"""Package a tested dist/ with an SBOM and a complete, hash-bound inventory."""
import datetime
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import uuid
from assets import ROOT, archive_files, digest, inventory, read_json, unpack_verified, write_json


def command(*args):
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()


def main():
    commit = command("git", "rev-parse", "HEAD")
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise ValueError("Invalid source commit")
    if command("git", "status", "--porcelain", "--untracked-files=no"):
        raise ValueError("Commit the build inputs before packaging a release")
    source_date = command("git", "show", "-s", "--format=%cI", commit)
    created = datetime.datetime.fromisoformat(source_date).astimezone(datetime.timezone.utc)
    tag = f"website-{created:%Y.%m.%d}-g{commit[:12]}"
    directory = ROOT / ".local/releases" / tag
    directory.mkdir(parents=True, exist_ok=False)
    lock = read_json(ROOT / "assets.lock.json")
    files = inventory(ROOT / "dist")
    if "index.html" not in files or not any(name.startswith("assets/") and name.endswith(".js") for name in files):
        raise ValueError("Missing production build")
    expected_assets = {f"factorio/{name}": data for name, data in lock["files"].items()}
    actual_assets = {name: data for name, data in files.items() if name.startswith("factorio/")}
    if actual_assets != expected_assets:
        raise ValueError("Production assets differ from the pinned pack")
    for name in files:
        if not (name == "index.html" or name == "branding/josh-cazalas.png" or name in expected_assets
                or re.fullmatch(r"assets/[^/]+\.(?:js|css)", name)):
            raise ValueError(f"Unexpected deployable file: {name}")
    site = directory / "website.tar.gz"
    archive_files(ROOT / "dist", files, site)
    with tempfile.TemporaryDirectory() as extracted:
        unpack_verified(site, files, extracted)
        if inventory(Path(extracted)) != files:
            raise ValueError("Packaged site differs from tested build")
    write_json(directory / "site-inventory.json", files)
    write_json(directory / "asset-inventory.json", lock)
    runtime = json.loads(command("npm", "sbom", "--sbom-format", "cyclonedx", "--omit", "dev"))
    build = json.loads(command("npm", "sbom", "--sbom-format", "cyclonedx"))
    timestamp = created.isoformat().replace("+00:00", "Z")
    # Scope is explicit: npm's dependency inventory is not a byte-level analysis of a tree-shaken bundle.
    for scope, sbom in (("runtime", runtime), ("build", build)):
        sbom["serialNumber"] = f"urn:uuid:{uuid.uuid5(uuid.NAMESPACE_URL, f'https://github.com/joshcazalas/website/{commit}/{scope}')}"
        sbom["metadata"]["timestamp"] = timestamp
        sbom["metadata"].setdefault("properties", []).append({"name": "website:inventory-scope", "value": f"{scope} npm dependency graph; media listed separately in asset-inventory.json"})
        write_json(directory / f"sbom-{scope}.cdx.json", sbom)
    manifest = {
        "schema": 1, "repository": "joshcazalas/website", "tag": tag,
        "commit": commit, "source_ref": os.environ.get("GITHUB_REF") or command("git", "symbolic-ref", "HEAD"), "source_date": timestamp,
        "asset_pack": {key: lock[key] for key in ("repository", "tag", "sha256", "factorio_version")},
        "toolchain": {"node": command("node", "--version"), "npm": command("npm", "--version")},
        "lockfile_sha256": digest((ROOT / "package-lock.json").read_bytes()),
        "files": inventory(directory),
    }
    write_json(directory / "manifest.json", manifest)
    sums = inventory(directory)
    (directory / "SHA256SUMS").write_text("".join(f"{data['sha256']}  {name}\n" for name, data in sorted(sums.items())))
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as output:
            output.write(f"tag={tag}\ndirectory={directory.relative_to(ROOT)}\n")
    print(f"Packaged {tag}: {site.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
