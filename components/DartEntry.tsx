type DartEntryProps = {
  message: string;
  compact: boolean;
};

export function DartEntry({ message, compact }: DartEntryProps) {
  return (
    <section
      className={`rounded-2xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] mb-8 ${
        compact ? "p-4" : "p-6"
      }`}
    >
      <div className={compact ? "text-lg mb-3" : "text-xl mb-4"}>
        {message}
      </div>

      <div className="rounded-2xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-4">
        <div className="text-xl font-bold mb-2">Dart-by-Dart Entry</div>

        <p className="text-[var(--color-text-muted)] mb-4">
          Dart-by-dart scoring mode is selected. The dart entry controls will be
          added here next.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-[var(--color-panel-border)] p-3">
            Dart 1
          </div>
          <div className="rounded-xl border border-[var(--color-panel-border)] p-3">
            Dart 2
          </div>
          <div className="rounded-xl border border-[var(--color-panel-border)] p-3">
            Dart 3
          </div>
        </div>
      </div>
    </section>
  );
}