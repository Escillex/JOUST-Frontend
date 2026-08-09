// Prioritize the environment variable if it's an absolute URL, otherwise fallback to the proxy.
const envApiUrl = process.env.NEXT_PUBLIC_API_URL;
export const API_URL = (envApiUrl && envApiUrl.startsWith('http')) 
  ? envApiUrl.replace(/\/$/, '') // Remove trailing slash
  : "/api/backend";

// Where the browser opens its Socket.IO connection. This is deliberately separate
// from API_URL, because the two have different requirements:
//
// REST can go through a same-origin proxy path ("/api/backend"), which Next.js
// rewrites server-side — container-to-container in Docker, so it never depends on
// a reachable LAN address. A socket cannot use that: Next.js does not forward
// "/socket.io/", so a relative base means the browser tries the frontend's own
// origin and every attempt 404s. That is why realtime never worked in the Docker
// dev stack, where NEXT_PUBLIC_API_URL is set to the relative proxy path.
//
// Resolution order:
//   1. NEXT_PUBLIC_SOCKET_URL  - set this in development to reach the backend directly
//   2. API_URL when it is absolute - the plain host setup, where both already match
//   3. undefined - same origin, which is correct in production where the reverse
//      proxy routes /socket.io/ to the backend
export const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  (API_URL.startsWith("http") ? API_URL : undefined);

export async function safeJson(res: Response) {
  const contentType = res.headers.get("content-type");
  const text = await res.text();
  
  if (!text) return null;
  
  if (contentType && contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("JSON Parse Error:", e, "Raw text:", text.substring(0, 100));
      return null;
    }
  }
  
  return null;
}

// Turns an image path from the backend (for example "/uploads/avatars/x.webp")
// into a URL the browser can load. Before this helper existed, the same
// "does it start with http?" check was copy-pasted in about 17 places.
// Rules:
// - full URLs (http...), in-memory previews (blob:) and inline images (data:)
//   are already usable, return them unchanged
// - backend uploads ("/uploads/...") need the API base URL in front
// - anything else (like "/placeholder.png") is a file from this app's own
//   public folder, return it unchanged
export function resolveImageUrl(url?: string | null, fallback = ""): string {
  if (!url) return fallback;
  if (url.startsWith("http") || url.startsWith("blob:") || url.startsWith("data:")) return url;
  if (url.startsWith("/uploads")) return `${API_URL}${url}`;
  if (url.startsWith("/")) return url;
  return `${API_URL}${url}`;
}

// Called when any request comes back as 401 (not signed in / session
// expired). The stored token is useless at that point, so remove it and
// tell the rest of the app (UserProvider listens for this event) so the
// UI stops showing the user as signed in. JWT sessions last 1 hour, and
// before this nothing reacted when they expired.
export const SESSION_EXPIRED_EVENT = "auth:session-expired";

function handleUnauthorized() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem("token")) {
    localStorage.removeItem("token");
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
}

// How long a request may stall before we give up on it.
//
// This exists because `fetch` rejects when a connection *fails* but not when one
// *stalls*, and stalling is the characteristic venue-Wi-Fi failure: the request
// leaves, nothing comes back, and the promise never settles. Callers almost all
// look like `try { ... } finally { setLoading(false) }`, so a promise that never
// settles means `finally` never runs and the user is left on a spinner forever,
// with no error and no way to retry. A timeout converts that dead end into the
// same synthetic error every caller already handles.
export const DEFAULT_TIMEOUT_MS = 8000;

// Uploads move real bytes over the same bad link, so they get their own budget.
// Pass `timeoutMs: 0` to opt out entirely.
export const UPLOAD_TIMEOUT_MS = 60000;

export interface AuthenticatedFetchOptions extends RequestInit {
  /** Milliseconds before the request is aborted. Defaults to DEFAULT_TIMEOUT_MS;
   *  0 disables the timeout. */
  timeoutMs?: number;
}

/** The shape returned when a request could not be completed at all. Not a real
 *  Response — `status: 0` is the sentinel every call site already branches on. */
function networkErrorResponse(message: string, statusText: string): Response {
  return {
    ok: false,
    status: 0,
    statusText,
    json: async () => ({ message }),
    text: async () => statusText,
  } as Response;
}

// Whether the backend is actually reachable, as opposed to whether the device
// merely has a network interface.
//
// `navigator.onLine` answers the second question only: it is `true` on a venue
// Wi-Fi that has stopped routing, on a captive portal, and whenever the backend
// itself is down. Those are precisely the cases we need to tell the user about,
// so reachability is inferred from what requests actually do. Only transitions
// are announced, otherwise every request would fire an event.
export const NETWORK_STATUS_EVENT = "network:status";

let backendReachable = true;

function reportReachability(reachable: boolean) {
  if (typeof window === "undefined") return;
  if (reachable === backendReachable) return;
  backendReachable = reachable;
  window.dispatchEvent(
    new CustomEvent(NETWORK_STATUS_EVENT, { detail: { reachable } }),
  );
}

export function isBackendReachable() {
  return backendReachable;
}

export async function authenticatedFetch(
  url: string,
  options: AuthenticatedFetchOptions = {},
) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: callerSignal, ...fetchOptions } = options;

  const headers = new Headers(fetchOptions.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Build the full URL, handling slashes carefully
  let fullUrl = url;
  if (!url.startsWith('http')) {
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    fullUrl = `${API_URL}${cleanPath}`;
  }

  const controller = new AbortController();
  const timer =
    timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  // If a caller supplied its own signal (a component unmounting, say), honour it
  // as well as the timeout — whichever fires first wins.
  const forwardAbort = () => controller.abort();
  callerSignal?.addEventListener('abort', forwardAbort);

  try {
    const response = await fetch(fullUrl, {
      ...fetchOptions,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });
    // Any answer at all — including a 500 — proves the round trip works, so it
    // clears an outstanding "no connection" state.
    reportReachability(true);
    // A 401 means the session is no longer valid, so clean up the stale
    // token once, centrally, instead of every page handling it itself.
    if (response.status === 401) {
      handleUnauthorized();
    }
    return response;
  } catch (error) {
    // A caller-driven abort is not a failure — the component simply went away.
    // Reporting it as a network error would flash an error state during normal
    // navigation, so it gets its own quiet path and does not touch reachability.
    if (callerSignal?.aborted) {
      return networkErrorResponse('Request cancelled.', 'Aborted');
    }

    reportReachability(false);

    const timedOut = error instanceof DOMException && error.name === 'AbortError';

    console.error(timedOut ? 'Request Timed Out:' : 'Critical Fetch Error:', {
      url: fullUrl,
      method: fetchOptions.method || 'GET',
      timeoutMs,
      message: error instanceof Error ? error.message : String(error),
      error,
    });

    // Both cases return status 0 so the ~90 existing call sites keep working
    // unchanged; only the message differs, because "too slow" and "no
    // connection" need different advice.
    return timedOut
      ? networkErrorResponse(
          'The server took too long to respond. Check your connection and try again.',
          'Timeout',
        )
      : networkErrorResponse(
          'Connection to server lost. Check network connection.',
          'Network Error',
        );
  } finally {
    if (timer) clearTimeout(timer);
    callerSignal?.removeEventListener('abort', forwardAbort);
  }
}

export const API_ENDPOINTS = {
  AUTH: {
    ME: '/auth/me',
    SIGNIN: '/auth/signin',
    SIGNUP: '/auth/signup',
    SIGNOUT: '/auth/signout',
    USERS: '/auth/users',
    ROLES: (id: string) => `/auth/roles/${id}`,
    // Guests are created through TOURNAMENTS.JOIN_GUEST, which attaches them to
    // a tournament in one call; there is no standalone guest-creation flow.
    CONVERT_GUEST: (id: string) => `/auth/convert-guest/${id}`,
    DELETE_USER: (id: string) => `/auth/users/${id}`,
    UPDATE_PROFILE: (id: string) => `/auth/users/${id}/profile`,
    ADMIN_CREATE_USER: '/auth/users',
    USER_MATCHES: (id: string) => `/users/${id}/matches`,
    // Lightweight stats for one user. Unlike the leaderboard endpoints,
    // this returns 404 only when the user really does not exist, so it
    // can be used to check that a user account is real.
    USER_BASIC_STATS: (id: string) => `/users/${id}/stats`,
  },
  NOTIFICATIONS: {
    LIST: '/notifications',
    READ: (id: string) => `/notifications/${id}/read`,
    READ_ALL: '/notifications/read-all',
  },
  ORGANIZERS: {
    LIST: (tournamentId: string) => `/tournaments/${tournamentId}/organizers`,
    INVITE: (tournamentId: string) => `/tournaments/${tournamentId}/organizers`,
    REVOKE: (tournamentId: string, userId: string) =>
      `/tournaments/${tournamentId}/organizers/${userId}`,
    MY_INVITATIONS: '/organizers/invitations',
    ACCEPT: (id: string) => `/organizers/invitations/${id}/accept`,
    DECLINE: (id: string) => `/organizers/invitations/${id}/decline`,
  },
  TOURNAMENTS: {
    BASE: '/tournaments',
    // Only the tournaments this user may manage; the backend applies the same
    // rule the guards do, which the client cannot compute for itself.
    MANAGEABLE: '/tournaments?manageable=true',
    CREATE: '/tournaments/createtournament',
    START: (id: string) => `/tournaments/starttournament/${id}`,
    COMPLETE: (id: string) => `/tournaments/${id}/complete`,
    JOIN: (id: string) => `/tournaments/${id}/participants/join`,
    JOIN_GUEST: (id: string) => `/tournaments/${id}/participants/guest`,
    LEAVE: (id: string) => `/tournaments/${id}/participants/leave`,
    UPDATE_SEED: (tournamentId: string, userId: string) => `/tournaments/${tournamentId}/participants/${userId}/seed`,
    FORFEIT: (tournamentId: string, userId: string) => `/tournaments/${tournamentId}/participants/${userId}/forfeit`,
    REPLACE: (tournamentId: string, userId: string) => `/tournaments/${tournamentId}/participants/${userId}/replace`,
    LEADERBOARD: (id: string) => `/tournaments/${id}/leaderboard`,
    GET_ONE: (id: string) => `/tournaments/${id}`,
    // Same record without the rounds/matches tree (plan 7.1). Use this on any
    // screen that does not draw a bracket: the full response is 7.7 KB at 8
    // players but 106.8 KB at 128, and polling it re-ships all of that.
    GET_ONE_SUMMARY: (id: string) => `/tournaments/${id}?view=summary`,
    ROUNDS: (id: string) => `/tournaments/${id}/rounds`,
    UPDATE_STATUS: (id: string) => `/tournaments/${id}/status`,
    REASSIGN_GAME: (id: string) => `/tournaments/${id}/game`,
    INVITE: (token: string) => `/tournaments/invite/${token}`,
    CANCEL_CLEANUP: (id: string) => `/tournaments/${id}/cancel-cleanup`,
    RESOLVE_TIE: (id: string) => `/tournaments/${id}/resolve-tie`,
    GLOBAL_LEADERBOARD: '/tournaments/leaderboard/global',
    LEADERBOARD_GAMES: '/tournaments/leaderboard/games',
    USER_STATS: (userId: string) => `/tournaments/users/${userId}/stats`,
  },
  // The old FORMATS group duplicated PRESETS (both pointed at
  // /tournament-formats). It was merged into PRESETS so the same route
  // is not defined twice with two different names.
  PRESETS: {
    BASE: '/tournament-formats',
    DETAILS: (id: string) => `/tournament-formats/${id}`,
    DELETE: (id: string) => `/tournament-formats/${id}`,
  },
  // The admin-managed game catalog. BASE is a public GET; POST/PATCH/DELETE are
  // admin-only; REQUEST lets an organizer ask admins for a missing game (todo.md §5).
  GAMES: {
    BASE: '/games',
    DETAILS: (id: string) => `/games/${id}`,
    DELETE: (id: string) => `/games/${id}`,
    REQUEST: '/games/request',
    // Admin queue of organizer game requests, and resolve/dismiss.
    REQUESTS: '/games/requests',
    RESOLVE_REQUEST: (id: string) => `/games/requests/${id}`,
  },
  MATCHES: {
    // Draws are reported through SUBMIT with no winnerId. The server also
    // exposes /matches/:id/draw, but that path validates less (it does not
    // reject bestOf > 1 or a points threshold), so it is deliberately unused.
    SUBMIT:         (id: string) => `/matches/${id}/submit`,
    GAME_RESULT:    (id: string) => `/matches/${id}/game-result`,
    GET_ONE:        (id: string) => `/matches/${id}`,
    TRACKER_OPEN:   (id: string) => `/matches/${id}/tracker/open`,
    TRACKER_UPDATE: (id: string) => `/matches/${id}/tracker/update`,
    TRACKER_SUBMIT: (id: string) => `/matches/${id}/tracker/submit-game`,
    TRACKER_GET:    (id: string) => `/matches/${id}/tracker`,
  },
  DEV: {
    BATCH_GUESTS: (tournamentId: string) => `/dev/batch-guests/${tournamentId}`,
    GUEST_EXPIRY: '/dev/config/guest-expiry',
    BACKFILL_GAME_STATS: '/dev/backfill-game-stats',
    DELETE_TOURNAMENT: (id: string) => `/dev/tournament/${id}`,
  },
  IMAGES: {
    UPLOAD_AVATAR: (userId: string) => `/images/avatar/${userId}`,
    DELETE_AVATAR: (userId: string) => `/images/avatar/${userId}`,
    UPLOAD_BANNER: (tournamentId: string) => `/images/banner/${tournamentId}`,
    DELETE_BANNER: (tournamentId: string) => `/images/banner/${tournamentId}`,
    UPSERT_ASSET: (key: string) => `/images/assets/${key}`,
    DELETE_ASSET: (key: string) => `/images/assets/${key}`,
    // Single assets are read out of the LIST_ASSETS response; the server has no
    // GET /images/assets/:key route.
    LIST_ASSETS: '/images/assets',
  },
  STORE: {
    LIST: '/store',
    LIST_ALL: '/store/all',
    CREATE: '/store',
    UPDATE: (id: string) => `/store/${id}`,
    DELETE: (id: string) => `/store/${id}`,
    UPLOAD_IMAGE: (id: string) => `/store/${id}/image`,
    DELETE_IMAGE: (id: string) => `/store/${id}/image`,
  },
};