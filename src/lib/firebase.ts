import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const WORKSPACE_SCOPES = {
  sheets: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly',
  ],
  drive: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.readonly',
  ],
  calendarRead: ['https://www.googleapis.com/auth/calendar.events.readonly'],
  calendarWrite: [
    'https://www.googleapis.com/auth/calendar.events.readonly',
    'https://www.googleapis.com/auth/calendar.events',
  ],
  forms: [
    'https://www.googleapis.com/auth/forms.body.readonly',
    'https://www.googleapis.com/auth/forms.responses.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
  ],
} as const;

export type WorkspaceScopeGroup = keyof typeof WORKSPACE_SCOPES;

export interface ClassifiedAuthError {
  code: string;
  kind: 'cancelled' | 'blocked' | 'error';
  title: string;
  message: string;
  hint: string;
}

export type BaseSignInResult =
  | { ok: true; user: User; idToken: string }
  | { ok: false; error: ClassifiedAuthError };

export type WorkspaceConnectResult =
  | {
      ok: true;
      user: User;
      idToken: string;
      accessToken: string;
      grantedGroups: WorkspaceScopeGroup[];
    }
  | { ok: false; error: ClassifiedAuthError };

// Strict in-memory token cache (never persisted to localStorage or sessionStorage)
let cachedWorkspaceToken: string | null = null;
let grantedScopeGroups = new Set<WorkspaceScopeGroup>();
let isPopupInFlight = false;

export function getCachedWorkspaceToken(): string | null {
  return cachedWorkspaceToken;
}

export function getGrantedScopeGroups(): WorkspaceScopeGroup[] {
  return Array.from(grantedScopeGroups);
}

export function clearWorkspaceToken(): void {
  cachedWorkspaceToken = null;
  grantedScopeGroups = new Set<WorkspaceScopeGroup>();
}

export function classifyFirebaseAuthError(
  err: any,
  context: 'signin' | 'workspace'
): ClassifiedAuthError {
  const code = typeof err?.code === 'string' ? err.code : 'auth/unknown';
  const actionLabel = context === 'workspace' ? 'Google Workspace authorization' : 'Google Sign-In';

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return {
      code,
      kind: 'cancelled',
      title: `${actionLabel} was canceled`,
      message: 'The Google sign-in window closed before authentication finished.',
      hint: 'Click Retry to reopen the Google sign-in window, or allow popups if your browser closed it automatically.',
    };
  }

  if (code === 'auth/popup-blocked') {
    return {
      code,
      kind: 'blocked',
      title: `Browser blocked the ${actionLabel} popup`,
      message: 'Your browser prevented the Google authentication window from opening.',
      hint: 'Allow popups for this site using the popup-blocker icon in your browser address bar, then click Retry.',
    };
  }

  if (code === 'auth/network-request-failed') {
    return {
      code,
      kind: 'error',
      title: 'Network error during Google Sign-In',
      message: 'Unable to reach Google authentication servers.',
      hint: 'Check your internet connection and click Retry.',
    };
  }

  if (code === 'auth/unauthorized-domain') {
    return {
      code,
      kind: 'error',
      title: 'Origin not authorized for Google Sign-In',
      message: 'This preview or host domain is not allowlisted in Firebase Authentication.',
      hint: 'Verify authorized domains in your Firebase project settings and try again.',
    };
  }

  return {
    code,
    kind: 'error',
    title: `${actionLabel} could not be completed`,
    message: err?.message || 'An unexpected error occurred while signing in with Google.',
    hint: 'Click Retry to try signing in again.',
  };
}

export async function signInWithGoogleBase(): Promise<BaseSignInResult> {
  if (isPopupInFlight) {
    return {
      ok: false,
      error: {
        code: 'auth/popup-in-progress',
        kind: 'cancelled',
        title: 'Google Sign-In is already open',
        message: 'A Google sign-in window is currently waiting for completion.',
        hint: 'Finish signing in using the open window, or dismiss it and click Retry.',
      },
    };
  }

  isPopupInFlight = true;
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();
    return { ok: true, user: result.user, idToken };
  } catch (err: any) {
    return { ok: false, error: classifyFirebaseAuthError(err, 'signin') };
  } finally {
    isPopupInFlight = false;
  }
}

export async function connectWorkspaceScopes(
  groups: WorkspaceScopeGroup[]
): Promise<WorkspaceConnectResult> {
  if (isPopupInFlight) {
    return {
      ok: false,
      error: {
        code: 'auth/popup-in-progress',
        kind: 'cancelled',
        title: 'Google authorization is already open',
        message: 'A Google permissions popup is already in progress.',
        hint: 'Complete the open Google window or close it and click Retry.',
      },
    };
  }

  isPopupInFlight = true;
  try {
    const provider = new GoogleAuthProvider();
    const nextGroups = new Set<WorkspaceScopeGroup>([
      ...grantedScopeGroups,
      ...groups,
    ]);
    const uniqueScopes = new Set<string>();
    nextGroups.forEach((group) => {
      WORKSPACE_SCOPES[group].forEach((s) => uniqueScopes.add(s));
    });

    uniqueScopes.forEach((scope) => provider.addScope(scope));
    provider.setCustomParameters({ prompt: 'consent' });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      return {
        ok: false,
        error: {
          code: 'auth/missing-access-token',
          kind: 'error',
          title: 'Workspace access token unavailable',
          message: 'Google sign-in completed, but no Workspace OAuth access token was returned.',
          hint: 'Click Retry and approve the requested Google Workspace permissions.',
        },
      };
    }

    cachedWorkspaceToken = credential.accessToken;
    grantedScopeGroups = nextGroups;

    const idToken = await result.user.getIdToken();
    return {
      ok: true,
      user: result.user,
      idToken,
      accessToken: cachedWorkspaceToken,
      grantedGroups: Array.from(grantedScopeGroups),
    };
  } catch (err: any) {
    return { ok: false, error: classifyFirebaseAuthError(err, 'workspace') };
  } finally {
    isPopupInFlight = false;
  }
}

export async function signOutClubPulse(): Promise<void> {
  clearWorkspaceToken();
  await signOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      clearWorkspaceToken();
    }
    callback(user);
  });
}

export async function getFreshIdToken(): Promise<string | null> {
  if (!auth.currentUser) return null;
  return auth.currentUser.getIdToken();
}
