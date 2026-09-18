#!/usr/bin/env python3
"""Install reviewed Linux CI binaries after checking their pinned SHA-256 digests."""
import hashlib
import io
from pathlib import Path
import tarfile
import urllib.request

TOOLS = {
    "gitleaks": (
        "https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz",
        "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb",
    ),
    "actionlint": (
        "https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_linux_amd64.tar.gz",
        "8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8",
    ),
}
directory = Path(__file__).resolve().parent.parent / ".local/tools"
directory.mkdir(parents=True, exist_ok=True)
for name, (url, expected) in TOOLS.items():
    with urllib.request.urlopen(url, timeout=60) as response:
        data = response.read()
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError(f"{name} archive checksum mismatch")
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
        member = archive.getmember(name)
        if not member.isfile():
            raise ValueError(f"Expected a regular {name} binary")
        destination = directory / name
        destination.write_bytes(archive.extractfile(member).read())
        destination.chmod(0o755)
    print(f"Installed verified {name}")
