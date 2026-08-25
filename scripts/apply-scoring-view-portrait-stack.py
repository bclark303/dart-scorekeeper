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


replace_once('fixed inset-0 z-[90] h-[100dvh] overflow-hidden bg-neutral-950 p-2 text-white','fixed inset-0 z-[90] h-[100dvh] overflow-y-auto bg-neutral-950 p-2 text-white landscape:min-[760px]:overflow-hidden','Scoring View viewport shell')
replace_once('mx-auto grid h-full max-w-[1600px] grid-rows-[auto_minmax(0,1fr)_auto] gap-1.5 overflow-hidden min-[760px]:grid-rows-[auto_minmax(0,1fr)]','mx-auto grid min-h-full max-w-[1600px] grid-rows-[auto_auto_auto] gap-1.5 overflow-visible landscape:min-[760px]:h-full landscape:min-[760px]:min-h-0 landscape:min-[760px]:grid-rows-[auto_minmax(0,1fr)] landscape:min-[760px]:overflow-hidden','Scoring View outer grid')
replace_once('grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-1.5 overflow-hidden min-[760px]:grid-cols-[minmax(0,1fr)_minmax(210px,250px)] min-[760px]:grid-rows-none','grid min-h-0 grid-rows-[auto_auto] gap-1.5 overflow-visible landscape:min-[760px]:grid-cols-[minmax(0,1fr)_minmax(210px,250px)] landscape:min-[760px]:grid-rows-none landscape:min-[760px]:overflow-hidden','Scoring View board/control layout')
replace_once('flex h-full min-h-0 items-center justify-center overflow-hidden','flex min-h-0 items-center justify-center overflow-hidden landscape:min-[760px]:h-full','Scoring View board container')
replace_once('renderDartBoard("h-full max-h-full w-auto max-w-full")','renderDartBoard("h-auto w-full max-w-full landscape:min-[760px]:h-full landscape:min-[760px]:max-h-full landscape:min-[760px]:w-auto")','Scoring View board sizing')
replace_once('grid max-h-[32dvh] min-h-0 grid-rows-[minmax(0,1fr)] gap-1.5 overflow-hidden rounded-xl border border-white/20 bg-neutral-900 p-1.5 shadow-2xl min-[760px]:max-h-none min-[760px]:grid-rows-[minmax(0,1fr)_auto]','grid min-h-0 grid-rows-[auto] gap-1.5 overflow-visible rounded-xl border border-white/20 bg-neutral-900 p-1.5 shadow-2xl landscape:min-[760px]:max-h-none landscape:min-[760px]:grid-rows-[minmax(0,1fr)_auto] landscape:min-[760px]:overflow-hidden','Scoring View controls panel')
replace_once('grid content-start gap-1.5 overflow-y-auto pr-0.5','grid content-start gap-1.5 overflow-visible pr-0.5 landscape:min-[760px]:overflow-y-auto','Scoring View controls scroll behavior')
replace_once('mt-auto hidden shrink-0 grid-cols-2 gap-1 border-t border-white/10 pt-1.5 min-[760px]:grid','mt-auto hidden shrink-0 grid-cols-2 gap-1 border-t border-white/10 pt-1.5 landscape:min-[760px]:grid','landscape utility rail visibility')
replace_once('flex shrink-0 flex-wrap items-center gap-1 rounded-lg border border-white/20 bg-neutral-900 p-1 shadow-2xl min-[760px]:hidden','flex shrink-0 flex-wrap items-center gap-1 rounded-lg border border-white/20 bg-neutral-900 p-1 shadow-2xl landscape:min-[760px]:hidden','portrait utility bar visibility')
path.write_text(text)

version_pairs=[('0.5.0-alpha.21','0.5.0-alpha.22'),('0.4.0-alpha.5','0.4.0-alpha.6')]
package=(ROOT/'package.json').read_text(); old_version=next((old for old,_ in version_pairs if old in package),None)
if old_version is None: raise RuntimeError('Unexpected app version')
new_version=dict(version_pairs)[old_version]
for relative in ['package.json','package-lock.json','lib/appInfo.ts']:
    target=ROOT/relative; value=target.read_text()
    if old_version not in value: raise RuntimeError(f'Expected {old_version} in {relative}')
    target.write_text(value.replace(old_version,new_version))
changelog_path=ROOT/'CHANGELOG.md'; changelog=changelog_path.read_text(); entry='- Scoring View is now orientation-aware: portrait mode gives the dartboard the full available width and stacks scoring controls underneath, while landscape keeps the compact right-hand control rail.\n'; unreleased=changelog.find('## Unreleased')
if unreleased < 0: raise RuntimeError('Could not find Unreleased changelog section')
fixed=changelog.find('### Fixed\n',unreleased)
if fixed>=0: insert_at=fixed+len('### Fixed\n')
else:
    changed=changelog.find('### Changed\n',unreleased)
    if changed<0: raise RuntimeError('Could not find changelog insertion point')
    insert_at=changed+len('### Changed\n')
changelog_path.write_text(changelog[:insert_at]+entry+changelog[insert_at:])
print(f'Applied portrait Scoring View stack and bumped {old_version} -> {new_version}')
