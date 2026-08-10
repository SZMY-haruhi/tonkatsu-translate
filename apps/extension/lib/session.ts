import type { SessionState } from './messaging';

let current: SessionState = { status: 'idle' };

export function getSessionState(): SessionState {
  return current;
}

export function setSessionState(next: SessionState): void {
  current = next;
}
