from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
target = ROOT / "scripts" / "apply-casual-pause-ui.py"
text = target.read_text()

old = '''replace_once(
    "app/casual/page.tsx",
    '        submitDummyScore={submitDummyScore}\\n      />\\n',
    '        submitDummyScore={submitDummyScore}\\n        initialSessionState={scoringViewSession}\\n        onSessionStateChange={setScoringViewSession}\\n        onExitGame={() => setIsExitGameOpen(true)}\\n      />\\n',
)
'''

new = '''replace_once(
    "app/casual/page.tsx",
    '        isCurrentThrowerDummy={isCurrentThrowerDummy()}\\n        dummyScore={dummyScore}\\n        submitDummyScore={submitDummyScore}\\n      />\\n    );\\n  }\\n\\n  function getFeedbackDiagnostics() {\\n',
    '        isCurrentThrowerDummy={isCurrentThrowerDummy()}\\n        dummyScore={dummyScore}\\n        submitDummyScore={submitDummyScore}\\n        initialSessionState={scoringViewSession}\\n        onSessionStateChange={setScoringViewSession}\\n        onExitGame={() => setIsExitGameOpen(true)}\\n      />\\n    );\\n  }\\n\\n  function getFeedbackDiagnostics() {\\n',
)
'''

count = text.count(old)
if count != 1:
    raise RuntimeError(f"Expected one ambiguous DartEntry patch block, found {count}.")
target.write_text(text.replace(old, new, 1))

source = target.read_text()
exec(compile(source, str(target), "exec"), {"__file__": str(target), "__name__": "__main__"})
