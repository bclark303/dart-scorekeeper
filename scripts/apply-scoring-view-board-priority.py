from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "components" / "DartEntry.tsx"
text = path.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one {label} match, found {count}")
    text = text.replace(old, new, 1)


replace_once('mx-auto grid h-full max-w-[1600px] grid-rows-[auto_minmax(0,1fr)_auto] gap-2 overflow-hidden','mx-auto grid h-full max-w-[1600px] grid-rows-[auto_minmax(0,1fr)_auto] gap-1.5 overflow-hidden min-[760px]:grid-rows-[auto_minmax(0,1fr)]','outer Scoring View grid')
replace_once('shrink-0 rounded-2xl border border-white/20 bg-neutral-900 px-4 py-2 shadow-2xl','shrink-0 rounded-xl border border-white/20 bg-neutral-900 px-3 py-1.5 shadow-2xl','Scoring View header shell')
replace_once('truncate text-2xl font-black leading-tight sm:text-3xl','truncate text-xl font-black leading-tight sm:text-2xl','Scoring View thrower heading')
replace_once('text-4xl font-black leading-none text-white sm:text-5xl','text-3xl font-black leading-none text-white sm:text-4xl','Scoring View score heading')
replace_once('grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-2 overflow-hidden min-[760px]:grid-cols-[minmax(0,1fr)_minmax(220px,300px)] min-[760px]:grid-rows-none','grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-1.5 overflow-hidden min-[760px]:grid-cols-[minmax(0,1fr)_minmax(210px,250px)] min-[760px]:grid-rows-none','Scoring View main layout')
replace_once('grid max-h-[42dvh] min-h-0 grid-rows-[auto_auto_auto] gap-2 overflow-y-auto rounded-2xl border border-white/20 bg-neutral-900 p-2 shadow-2xl min-[760px]:max-h-none min-[760px]:overflow-y-auto','grid max-h-[32dvh] min-h-0 grid-rows-[minmax(0,1fr)] gap-1.5 overflow-hidden rounded-xl border border-white/20 bg-neutral-900 p-1.5 shadow-2xl min-[760px]:max-h-none min-[760px]:grid-rows-[minmax(0,1fr)_auto]','Scoring View side panel')

side_panel = 'grid max-h-[32dvh] min-h-0 grid-rows-[minmax(0,1fr)] gap-1.5 overflow-hidden rounded-xl border border-white/20 bg-neutral-900 p-1.5 shadow-2xl min-[760px]:max-h-none min-[760px]:grid-rows-[minmax(0,1fr)_auto]'
side_index = text.index(side_panel)
inner_index = text.find('<div className="grid gap-2">', side_index)
if inner_index < 0:
    raise RuntimeError('Could not find side-panel content grid')
text = text[:inner_index] + text[inner_index:].replace('<div className="grid gap-2">','<div className="grid content-start gap-1.5 overflow-y-auto pr-0.5">',1)

bottom_toolbar_marker = '            <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-white/20 bg-neutral-900 p-2 shadow-2xl">'
bottom_index = text.find(bottom_toolbar_marker, side_index)
if bottom_index < 0:
    raise RuntimeError('Could not find bottom Scoring View toolbar')
prefix = text[:bottom_index]
closing = '              </div>\n            </div>\n\n'
close_index = prefix.rfind(closing)
if close_index < 0:
    raise RuntimeError('Could not find side-panel closing tags')
rail_toolbar = '''              </div>\n\n              <div className="mt-auto hidden shrink-0 grid-cols-2 gap-1 border-t border-white/10 pt-1.5 min-[760px]:grid">\n                <label className="flex min-h-9 cursor-pointer items-center justify-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[0.7rem] font-bold text-white/80 hover:bg-white/10">\n                  <input type="checkbox" checked={autoFullscreenBoard} onChange={(event) => setAutoFullscreenPreference(event.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />\n                  Auto\n                </label>\n                <button type="button" onClick={() => { setDartInputStyle("board"); setHasAutoOpenedBoard(false); }} className={`min-h-9 rounded-md border px-2 py-1 text-[0.7rem] font-bold ${dartInputStyle === "board" ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10"}`}>Board</button>\n                <button type="button" onClick={() => setDartInputStyle("numeric")} className={`min-h-9 rounded-md border px-2 py-1 text-[0.7rem] font-bold ${dartInputStyle === "numeric" ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10"}`}>Numeric</button>\n                <button type="button" onClick={() => { setShowFullscreenScorecard(false); setIsBoardFullscreen(false); setHasAutoOpenedBoard(true); }} className="min-h-9 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[0.7rem] font-bold text-white/75 hover:bg-white/10">App View</button>\n                {onExitGame && (<button type="button" onClick={onExitGame} className="col-span-2 min-h-9 rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-2 py-1 text-[0.7rem] font-bold text-white/80 hover:bg-[var(--color-danger)]/20">Exit Game</button>)}\n              </div>\n            </div>\n\n'''
text = prefix[:close_index] + rail_toolbar + text[bottom_index:]
replace_once('flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-white/20 bg-neutral-900 p-2 shadow-2xl','flex shrink-0 flex-wrap items-center gap-1 rounded-lg border border-white/20 bg-neutral-900 p-1 shadow-2xl min-[760px]:hidden','narrow-layout bottom toolbar')
replace_once('flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-white/80 hover:bg-white/10','flex min-h-9 cursor-pointer items-center justify-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs font-bold text-white/80 hover:bg-white/10','narrow auto button')
text = text.replace('min-h-10 rounded-lg border px-3 py-2 text-xs font-bold','min-h-9 rounded-md border px-2 py-1 text-xs font-bold',2)
text = text.replace('min-h-10 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold','min-h-9 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs font-bold',1)
text = text.replace('ml-auto min-h-10 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-3 py-2 text-xs font-bold','ml-auto min-h-9 rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-2 py-1 text-xs font-bold',1)
path.write_text(text)

version_pairs=[('0.5.0-alpha.20','0.5.0-alpha.21'),('0.4.0-alpha.4','0.4.0-alpha.5')]
package=(ROOT/'package.json').read_text()
old_version=next((old for old,_ in version_pairs if old in package),None)
if old_version is None: raise RuntimeError('Unexpected app version')
new_version=dict(version_pairs)[old_version]
for relative in ['package.json','package-lock.json','lib/appInfo.ts']:
    target=ROOT/relative; value=target.read_text()
    if old_version not in value: raise RuntimeError(f'Expected {old_version} in {relative}')
    target.write_text(value.replace(old_version,new_version))
changelog_path=ROOT/'CHANGELOG.md'; changelog=changelog_path.read_text(); entry='- Rebalanced Scoring View to prioritize dartboard size: landscape utility controls are pinned in a narrow side rail instead of consuming dartboard height, with a tighter header and control rail.\n'; unreleased=changelog.find('## Unreleased'); fixed=changelog.find('### Fixed\n',unreleased)
if fixed>=0: insert_at=fixed+len('### Fixed\n')
else:
    changed=changelog.find('### Changed\n',unreleased)
    if changed<0: raise RuntimeError('Could not find changelog insertion point')
    insert_at=changed+len('### Changed\n')
changelog_path.write_text(changelog[:insert_at]+entry+changelog[insert_at:])
print(f'Applied board-priority Scoring View layout and bumped {old_version} -> {new_version}')
