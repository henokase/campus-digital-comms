export const FEEDBACK_CHANGED_EVENT = 'cdcp:feedback-changed'

export function emitFeedbackChanged() {
  try {
    window.dispatchEvent(new Event(FEEDBACK_CHANGED_EVENT))
  } catch {
    // ignore
  }
}
