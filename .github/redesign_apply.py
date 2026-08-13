#!/usr/bin/env python3
from pathlib import Path
import base64, gzip, io, re, tarfile

groups = {}
for part in sorted(Path(".github/redesign_sources").glob("*.part*")):
    destination = part.name.split(".part", 1)[0].replace("__", "/")
    groups.setdefault(destination, []).append(part)

archive_buffer = io.BytesIO()
with tarfile.open(fileobj=archive_buffer, mode="w:gz") as archive:
    for destination, parts in sorted(groups.items()):
        data = "".join(p.read_text(encoding="utf-8") for p in sorted(parts)).encode("utf-8")
        info = tarfile.TarInfo(destination)
        info.size = len(data)
        archive.addfile(info, io.BytesIO(data))

payload = base64.b64encode(archive_buffer.getvalue()).decode("ascii")
chunk_size = (len(payload) + 2) // 3
for index in range(3):
    Path(f".github/redesign_payload_{index + 1}.txt").write_text(payload[index * chunk_size:(index + 1) * chunk_size], encoding="ascii")

compressed = Path(".github/redesign_code_payload.txt").read_text(encoding="ascii").strip()
source = gzip.decompress(base64.b64decode(compressed)).decode("utf-8")
exec(compile(source, ".github/redesign_apply_compiled.py", "exec"), {"__name__": "__main__"})

for path, old, new in [
    ("app/league-play/page.tsx", 'href: "/game-nights", title: "Game Night"', 'href: "/game-nights/control", title: "Game Night"'),
    ("app/league-play/play/page.tsx", 'href="/game-nights"', 'href="/game-nights/control"'),
]:
    file = Path(path)
    file.write_text(file.read_text(encoding="utf-8").replace(old, new, 1), encoding="utf-8")

casual_path = Path("app/casual/page.tsx")
casual = casual_path.read_text(encoding="utf-8")
pattern = re.compile(r'<a(?P<before>[^>]*)href="/"(?P<after>[^>]*)>(?P<body>.*?)</a>', re.DOTALL)
def convert(match):
    attrs = match.group("before") + " " + match.group("after")
    class_match = re.search(r'className="([^"]*)"', attrs)
    classes = class_match.group(1) if class_match else ""
    close_menu = "setIsGameMenuOpen(false); " if "setIsGameMenuOpen(false)" in attrs else ""
    return f'<button type="button" onClick={{() => {{ {close_menu}window.location.href = "/"; }}}} className="{classes}">{match.group("body")}</button>'
casual_path.write_text(pattern.sub(convert, casual), encoding="utf-8")

changelog = Path("CHANGELOG.md")
text = changelog.read_text(encoding="utf-8").replace(
    "- Reworked Game Night into a state-aware control dashboard with focused Check-in, Teams, Boards, Fixtures/Rounds, Options, and Statistics child views.",
    "- Added a state-aware Game Night Control dashboard for readiness, live room status, next actions, and completion, while preserving the existing detailed setup and fixture workspaces.",
)
changelog.write_text(text, encoding="utf-8")
