/**
 * Who you are in a group, remembered on this phone.
 *
 * Joining hands back a member id and a secret. The secret is what proves to
 * the server that a confirmation really comes from you — so it lives only
 * here, on the device that joined, and is never shown on screen.
 *
 * Storage can be unavailable (private browsing, blocked site data); every
 * access is guarded so the page still renders, just without a saved session.
 */

export interface GroupSession {
  memberId: string;
  secret: string;
}

const key = (groupId: string) => `squash:group:${groupId}`;

export function loadSession(groupId: string): GroupSession | null {
  try {
    const raw = localStorage.getItem(key(groupId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GroupSession;
    return parsed?.memberId && parsed?.secret ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSession(groupId: string, session: GroupSession): void {
  try {
    localStorage.setItem(key(groupId), JSON.stringify(session));
  } catch {
    // Without storage the person stays in for this visit only.
  }
}

export function clearSession(groupId: string): void {
  try {
    localStorage.removeItem(key(groupId));
  } catch {
    // nothing to clear
  }
}
