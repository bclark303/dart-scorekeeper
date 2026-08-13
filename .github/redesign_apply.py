#!/usr/bin/env python3
from pathlib import Path
import base64
import gzip
import io
import tarfile

groups: dict[str, list[Path]] = {}
for part in sorted(Path(".github/redesign_sources").glob("*.part*")):
    stem = part.name.split(".part", 1)[0]
    destination = stem.replace("__", "/")
    groups.setdefault(destination, []).append(part)

archive_buffer = io.BytesIO()
with tarfile.open(fileobj=archive_buffer, mode="w:gz") as archive:
    for destination, parts in sorted(groups.items()):
        data = "".join(part.read_text(encoding="utf-8") for part in sorted(parts)).encode("utf-8")
        info = tarfile.TarInfo(destination)
        info.size = len(data)
        archive.addfile(info, io.BytesIO(data))

payload = base64.b64encode(archive_buffer.getvalue()).decode("ascii")
chunk_size = (len(payload) + 2) // 3
for index in range(3):
    Path(f".github/redesign_payload_{index + 1}.txt").write_text(
        payload[index * chunk_size : (index + 1) * chunk_size],
        encoding="ascii",
    )

compressed = Path(".github/redesign_code_payload.txt").read_text(encoding="ascii").strip()
source = gzip.decompress(base64.b64decode(compressed)).decode("utf-8")
exec(compile(source, ".github/redesign_apply_compiled.py", "exec"), {"__name__": "__main__"})

league_play = Path("app/league-play/page.tsx")
league_play.write_text(
    league_play.read_text(encoding="utf-8").replace(
        'href: "/game-nights", title: "Game Night"',
        'href: "/game-nights/control", title: "Game Night"',
        1,
    ),
    encoding="utf-8",
)

play_page = Path("app/league-play/play/page.tsx")
play_page.write_text(
    play_page.read_text(encoding="utf-8").replace(
        'href="/game-nights"',
        'href="/game-nights/control"',
        1,
    ),
    encoding="utf-8",
)

changelog = Path("CHANGELOG.md")
text = changelog.read_text(encoding="utf-8")
text = text.replace(
    "- Reworked Game Night into a state-aware control dashboard with focused Check-in, Teams, Boards, Fixtures/Rounds, Options, and Statistics child views.",
    "- Added a state-aware Game Night Control dashboard for readiness, live room status, next actions, and completion, while preserving the existing detailed setup and fixture workspaces.",
)
changelog.write_text(text, encoding="utf-8")
