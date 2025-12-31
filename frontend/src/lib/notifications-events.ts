export const NOTIFICATIONS_CHANGED_EVENT = 'cdcp:notifications-changed'

export function emitNotificationsChanged() {
  try {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT))
  } catch {
    // ignore
  }
}
