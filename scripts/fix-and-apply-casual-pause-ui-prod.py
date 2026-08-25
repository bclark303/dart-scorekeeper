from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
target = ROOT / "scripts" / "apply-casual-pause-ui-prod.py"
text = target.read_text()

old_added = '''replace_once(
    "CHANGELOG.md",
    '### Added\\n',
    '### Added\\n- Casual games can be paused into up to five named local save slots and resumed with exact score, turn, leg, history, checkout-prompt, and in-progress dart-entry state preserved.\\n- Active casual games now have an Exit Game action with Pause Game and confirmed Discard Game paths; paused/discarded games never enter completed-match statistics.\\n',
)
'''
new_added = '''replace_once(
    "CHANGELOG.md",
    '## Unreleased\\n\\n### Added\\n',
    '## Unreleased\\n\\n### Added\\n- Casual games can be paused into up to five named local save slots and resumed with exact score, turn, leg, history, checkout-prompt, and in-progress dart-entry state preserved.\\n- Active casual games now have an Exit Game action with Pause Game and confirmed Discard Game paths; paused/discarded games never enter completed-match statistics.\\n',
)
'''
old_changed = '''replace_once(
    "CHANGELOG.md",
    '### Changed\\n',
    '### Changed\\n- Renamed the dedicated dart-entry interface to Scoring View and its presentation-only return control to App View.\\n- Updated production version to v0.4.0-alpha.3.\\n',
)
'''
new_changed = '''replace_once(
    "CHANGELOG.md",
    '### Changed\\n- Updated development version to v0.4.0-alpha.2.\\n',
    '### Changed\\n- Renamed the dedicated dart-entry interface to Scoring View and its presentation-only return control to App View.\\n- Updated production version to v0.4.0-alpha.3.\\n- Updated development version to v0.4.0-alpha.2.\\n',
)
'''

for old, new, label in ((old_added, new_added, "Added"), (old_changed, new_changed, "Changed")):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one {label} changelog patch block, found {count}.")
    text = text.replace(old, new, 1)

target.write_text(text)
source = target.read_text()
exec(compile(source, str(target), "exec"), {"__file__": str(target), "__name__": "__main__"})
