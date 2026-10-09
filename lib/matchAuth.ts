import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { extractBearerToken, getEffectiveAccess, type EffectiveAccess } from "./adminAccess";

// Single place for match-related authorization. Every API that touches a
// match must go through one of these helpers, so the rules cannot drift:
//
//   - not logged in / invalid session  -> 401
//   - logged in but not allowed        -> 403
//   - Admin                            -> any match
//   - Referee                          -> only matches whose referee_id is one
//                                         of the Referee's own approved
//                                         staff_applications ids
//
// Nothing here trusts data sent by the browser (role, referee id, isAdmin...):
// identity comes from the Supabase session token and everything else is read
// from the database on the server.

export type AuthFailure = { ok: false; status: 401 | 403; error: string };
export type AuthSuccess = { ok: true; access: EffectiveAccess };
export type AuthResult = AuthFailure | AuthSuccess;

export function authErrorResponse(failure: AuthFailure) {
  return NextResponse.json({ error: failure.error }, { status: failure.status });
}

export async function getAuthenticatedAccess(request: NextRequest): Promise<AuthResult> {
  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) return { ok: false, status: 401, error: "Not authenticated." };

  const access = await getEffectiveAccess(token);
  if (!access.authenticated) return { ok: false, status: 401, error: "Invalid or expired session." };

  return { ok: true, access };
}

// Admin only (Owner, legacy admin login, Discord server Administrator or
// 'administrator' site role - see lib/adminAccess.ts).
export async function assertAdmin(request: NextRequest): Promise<AuthResult> {
  const auth = await getAuthenticatedAccess(request);
  if (!auth.ok) return auth;
  if (!auth.access.isAdmin) return { ok: false, status: 403, error: "Administrator access required." };
  return auth;
}

export function isRefereeAssignedToMatch(
  access: EffectiveAccess,
  match: { referee_id?: number | string | null },
): boolean {
  if (match.referee_id === null || match.referee_id === undefined || match.referee_id === "") return false;
  const assigned = Number(match.referee_id);
  if (!Number.isFinite(assigned)) return false;
  return access.refereeStaffIds.includes(assigned);
}

// Admin: any match. Referee: only the match assigned to them. Everyone else: 403.
// `match` must be the row read from the database by the API, never data from
// the request body. Call this after getAuthenticatedAccess() succeeded.
export function authorizeAdminOrAssignedReferee(
  access: EffectiveAccess,
  match: { referee_id?: number | string | null },
): AuthResult {
  if (access.isAdmin) return { ok: true, access };

  if (!access.isRefereeStaff) {
    return { ok: false, status: 403, error: "You do not have permission to manage matches." };
  }
  if (!isRefereeAssignedToMatch(access, match)) {
    return { ok: false, status: 403, error: "You are not assigned as referee for this match." };
  }
  return { ok: true, access };
}
