from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one {label} match, found {count}")
    return text.replace(old, new, 1)


path = ROOT / "components" / "DartEntry.tsx"
text = path.read_text()

text = replace_once(
    text,
    'mx-auto grid h-full max-w-[1600px] grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden',
    'mx-auto grid h-full max-w-[1600px] grid-rows-[auto_minmax(0,1fr)_auto] gap-2 overflow-hidden',
    "outer Scoring View grid",
)

text = replace_once(
    text,
    'grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-2 overflow-hidden min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(230px,320px)] min-[1100px]:grid-rows-none',
    'grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-2 overflow-hidden min-[760px]:grid-cols-[minmax(0,1fr)_minmax(220px,300px)] min-[760px]:grid-rows-none',
    "responsive Scoring View content grid",
)

text = replace_once(
    text,
    'grid max-h-[38dvh] min-h-0 grid-rows-[auto_auto_auto_auto_auto] gap-2 overflow-hidden rounded-2xl border border-white/20 bg-neutral-900 p-2 shadow-2xl min-[1100px]:max-h-none min-[1100px]:grid-rows-[auto_auto_auto_auto_1fr]',
    'grid max-h-[42dvh] min-h-0 grid-rows-[auto_auto_auto] gap-2 overflow-y-auto rounded-2xl border border-white/20 bg-neutral-900 p-2 shadow-2xl min-[760px]:max-h-none min-[760px]:overflow-y-auto',
    "Scoring View side controls",
)

# Remove the presentation/exit controls from the scrollable side panel.
toolbar_start_marker = '                  <div className="grid grid-cols-4 gap-2">\n                    <label className="flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2 py-2 text-xs font-bold text-white/80 hover:bg-white/10">'
toolbar_start = text.find(toolbar_start_marker)
if toolbar_start < 0:
    raise RuntimeError("Could not find existing Scoring View toolbar")

exit_label = text.find('                        Exit Game', toolbar_start)
if exit_label < 0:
    # League Scoring View has no Exit Game callback, so end after App View block.
    app_view_label = text.find('                      App View', toolbar_start)
    if app_view_label < 0:
        raise RuntimeError("Could not find App View control")
    toolbar_end = text.find('                  </div>', app_view_label)
    if toolbar_end < 0:
        raise RuntimeError("Could not find end of Scoring View toolbar")
    toolbar_end += len('                  </div>\n')
else:
    exit_conditional_end = text.find('                  )}', exit_label)
    if exit_conditional_end < 0:
        raise RuntimeError("Could not find end of Exit Game conditional")
    toolbar_end = exit_conditional_end + len('                  )}\n')

text = text[:toolbar_start] + text[toolbar_end:]

# Add an always-visible viewport-reserved toolbar below the board/control area.
tail_marker = '            </div>\n          </div>\n        </div>\n      )}'
tail_index = text.rfind(tail_marker)
if tail_index < 0:
    raise RuntimeError("Could not find Scoring View closing layout")

bottom_toolbar = '''            </div>\n\n            <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-white/20 bg-neutral-900 p-2 shadow-2xl">\n              <label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-white/80 hover:bg-white/10">\n                <input\n                  type="checkbox"\n                  checked={autoFullscreenBoard}\n                  onChange={(event) =>\n                    setAutoFullscreenPreference(event.target.checked)\n                  }\n                  className="h-4 w-4 accent-[var(--color-primary)]"\n                />\n                Auto\n              </label>\n\n              <button\n                type="button"\n                onClick={() => {\n                  setDartInputStyle("board");\n                  setHasAutoOpenedBoard(false);\n                }}\n                className={`min-h-10 rounded-lg border px-3 py-2 text-xs font-bold ${dartInputStyle === "board"\n                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"\n                  : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10"\n                  }`}\n              >\n                Board\n              </button>\n\n              <button\n                type="button"\n                onClick={() => setDartInputStyle("numeric")}\n                className={`min-h-10 rounded-lg border px-3 py-2 text-xs font-bold ${dartInputStyle === "numeric"\n                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"\n                  : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10"\n                  }`}\n              >\n                Numeric\n              </button>\n\n              <button\n                type="button"\n                onClick={() => {\n                  setShowFullscreenScorecard(false);\n                  setIsBoardFullscreen(false);\n                  setHasAutoOpenedBoard(true);\n                }}\n                className="min-h-10 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-white/75 hover:bg-white/10"\n              >\n                App View\n              </button>\n\n              {onExitGame && (\n                <button\n                  type="button"\n                  onClick={onExitGame}\n                  className="ml-auto min-h-10 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-3 py-2 text-xs font-bold text-white/80 hover:bg-[var(--color-danger)]/20"\n                >\n                  Exit Game\n                </button>\n              )}\n            </div>\n'''

text = text[:tail_index] + bottom_toolbar + text[tail_index + len('            </div>\n'):]

path.write_text(text)

# Patch release version on either current release line.
version_pairs = [
    ("0.5.0-alpha.19", "0.5.0-alpha.20"),
    ("0.4.0-alpha.3", "0.4.0-alpha.4"),
]
old_version = next((old for old, new in version_pairs if old in (ROOT / "package.json").read_text()), None)
if old_version is None:
    raise RuntimeError("Unexpected app version")
new_version = dict(version_pairs)[old_version]

for relative in ["package.json", "package-lock.json", "lib/appInfo.ts"]:
    target = ROOT / relative
    value = target.read_text()
    if old_version not in value:
        raise RuntimeError(f"Expected {old_version} in {relative}")
    target.write_text(value.replace(old_version, new_version))

changelog_path = ROOT / "CHANGELOG.md"
changelog = changelog_path.read_text()
entry = "- Scoring View now reserves an always-visible bottom control bar and switches to the side-by-side tablet layout at narrower widths so App View and Exit Game stay on-screen.\n"
unreleased = changelog.find("## Unreleased")
if unreleased < 0:
    raise RuntimeError("Could not find Unreleased changelog section")
fixed = changelog.find("### Fixed\n", unreleased)
if fixed >= 0:
    insert_at = fixed + len("### Fixed\n")
    changelog = changelog[:insert_at] + entry + changelog[insert_at:]
else:
    changed = changelog.find("### Changed\n", unreleased)
    if changed < 0:
        raise RuntimeError("Could not find a changelog insertion point")
    insert_at = changed + len("### Changed\n")
    changelog = changelog[:insert_at] + entry + changelog[insert_at:]
changelog_path.write_text(changelog)

print(f"Applied Scoring View fit fix and bumped {old_version} -> {new_version}")
