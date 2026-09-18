#!/usr/bin/env python3
"""Stage only explicitly approved public files for the production build."""
import shutil
from assets import ROOT, read_json, verify_installed

lock = read_json(ROOT / "assets.lock.json")
verify_installed(lock, ROOT / "public/factorio")
output = ROOT / ".local/build-public"
if output.exists():
    shutil.rmtree(output)
for name in lock["files"]:
    destination = output / "factorio" / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / "public/factorio" / name, destination)
branding = output / "branding"
branding.mkdir(parents=True)
shutil.copyfile(ROOT / "public/branding/josh-cazalas.png", branding / "josh-cazalas.png")
print(f"Staged {len(lock['files'])} runtime assets and the nameplate")
