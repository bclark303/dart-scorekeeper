"use client";

type FeedbackType = "bug" | "feature" | "general";

type FeedbackSubmitStatus = "idle" | "submitting" | "success" | "error";

type FeedbackModalProps = {
  isOpen: boolean;
  feedbackType: FeedbackType;
  feedbackMessage: string;
  diagnostics: string;
  feedbackSubmitStatus: FeedbackSubmitStatus;
  feedbackSubmitError: string;
  setFeedbackType: (type: FeedbackType) => void;
  setFeedbackMessage: (message: string) => void;
  submitFeedback: () => void;
  closeFeedbackModal: () => void;
};

export function FeedbackModal({
  isOpen,
  feedbackType,
  feedbackMessage,
  diagnostics,
  feedbackSubmitStatus,
  feedbackSubmitError,
  setFeedbackType,
  setFeedbackMessage,
  submitFeedback,
  closeFeedbackModal,
}: FeedbackModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center">
      <div className="w-full max-w-2xl rounded-2xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-bold">Send Feedback</h2>
            <p className="text-[var(--color-text-muted)]">
              Report a bug, request a feature, or send general notes.
            </p>
          </div>

          <button
            onClick={closeFeedbackModal}
            className="rounded-xl bg-[var(--color-panel-soft)] hover:bg-[var(--color-panel-border)] px-3 py-2 font-bold"
          >
            ✕
          </button>
        </div>

        <label className="block mb-4">
          <span className="block text-[var(--color-text-muted)] mb-2">
            Feedback Type
          </span>
          <select
            className="w-full rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-3"
            value={feedbackType}
            onChange={(event) =>
              setFeedbackType(event.target.value as FeedbackType)
            }
          >
            <option value="bug">Bug Report</option>
            <option value="feature">Feature Request</option>
            <option value="general">General Feedback</option>
          </select>
        </label>

        <label className="block mb-4">
          <span className="block text-[var(--color-text-muted)] mb-2">
            Message
          </span>
          <textarea
            className="w-full min-h-36 rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-3"
            value={feedbackMessage}
            onChange={(event) => setFeedbackMessage(event.target.value)}
            placeholder="What happened? What were you trying to do? What would you like added?"
          />
        </label>

        <details className="mb-4 rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-3">
          <summary className="cursor-pointer font-bold">
            Diagnostics included with report
          </summary>

          <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-sm text-[var(--color-text-muted)]">
            {diagnostics}
          </pre>
        </details>

        {feedbackSubmitStatus === "success" && (
          <div className="mb-4 rounded-xl border border-[var(--color-success)]/40 bg-[var(--color-success)]/20 p-3">
            Feedback sent. Thanks!
          </div>
        )}

        {feedbackSubmitStatus === "error" && (
          <div className="mb-4 rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/20 p-3">
            {feedbackSubmitError ||
              "Feedback could not be sent. Please try again."}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={submitFeedback}
            disabled={
              feedbackSubmitStatus === "submitting" ||
              feedbackMessage.trim() === ""
            }
            className="rounded-xl bg-[var(--color-success)] hover:bg-[var(--color-success-hover)] disabled:opacity-50 p-4 text-lg font-bold"
          >
            {feedbackSubmitStatus === "submitting"
              ? "Submitting..."
              : "Submit Feedback"}
          </button>
          <button
            onClick={closeFeedbackModal}
            className="rounded-xl bg-[var(--color-panel-soft)] hover:bg-[var(--color-panel-border)] p-4 text-lg font-bold"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
