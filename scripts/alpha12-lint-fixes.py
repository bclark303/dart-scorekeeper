from pathlib import Path

path = Path("app/board-device/page.tsx")
text = path.read_text()
old = "Start a local game without changing this device's venue/board assignment."
new = "Start a local game without changing this device&apos;s venue/board assignment."
if old not in text:
    raise SystemExit("board-device apostrophe pattern was not found")
path.write_text(text.replace(old, new, 1))
print("alpha.12 scorer copy lint fixed")
