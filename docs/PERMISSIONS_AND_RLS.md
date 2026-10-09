# Match permissions (Admin / Referee) and Supabase RLS

## Rules enforced by the server

| Action                         | Admin | Referee assigned to the match | Other Referee | Logged-in user | Not logged in |
|--------------------------------|:-----:|:-----------------------------:|:-------------:|:--------------:|:-------------:|
| Start Match (`/api/match-start`)        | ✔ any match | ✔ only its own | 403 | 403 | 401 |
| Edit Score (`/api/match-score`)         | ✔ any match | ✔ only its own, only while **Live** | 403 | 403 | 401 |
| Finish Stats / Finish Match (`/api/match-finish`) | ✔ | **403** | 403 | 403 | 401 |
| Everything else in the Admin panel      | ✔ | 403 | 403 | 403 | 401 |

* "Admin" = Owner, legacy admin login, Discord server Administrator or `administrator` in `site_user_roles` (unchanged, see `lib/adminAccess.ts`).
* "Referee" = the person's Discord ID matches an **approved** `staff_applications` row with `role = 'Referee'`
  (or has the `referee` site role). A match belongs to a Referee when `matches.referee_id` is the id of one of
  *their own* approved Referee applications. Nothing is read from the request body (role, referee id, isAdmin…).
* All checks live in `lib/matchAuth.ts` (`assertAdmin`, `getAuthenticatedAccess`, `authorizeAdminOrAssignedReferee`)
  and are used by `match-start`, `match-score`, `match-finish`, `match-notify`, `staff-approve`, `admin/users`, `referee-rating`.

## Why referees could not reach the panel before

1. `/api/admin/access` only looked at `site_user_roles`. A person with an **approved Referee application** but no
   `referee` row there was treated as a normal user. It now also resolves approved Referee applications.
2. The Matches list hid every match from non-admins unless they were a Stat Tracker, so a Referee saw an empty list.
3. Referees had no "Save score" path at all, and `/api/match-start` only recognised the `administrator` site role
   (Owner / Discord-admin Admins were rejected) and used `maybeSingle()` on the application lookup
   (breaks when a person has two approved applications).

## Database changes

**None were applied.** No columns, tables or data were touched.

## ⚠ Recommended: check RLS on `matches` (not something the code can verify for you)

The Admin panel still writes to `matches` straight from the browser with the public (anon) key for **Admin**
actions such as *Save Changes* and *Delete Match* (unchanged, to preserve existing behaviour). Those writes are
only as safe as your RLS policies. The project does not contain the policies, so please check them in the Supabase
SQL editor. These queries are read-only:

```sql
-- Is RLS on, and which policies exist on matches?
select relname, relrowsecurity, relforcerowsecurity from pg_class where relname = 'matches';
select policyname, cmd, roles, qual, with_check from pg_policies where tablename = 'matches';
```

What you want to see: `select` allowed for everyone (public schedule), and `insert / update / delete` allowed
**only** to Admins (e.g. through `user_roles.role = 'admin'` / a helper function), **not** to `authenticated` in
general and **not** based on a role the user can edit. If an `update` policy lets any authenticated user (or any
Referee) write `matches`, a Referee could bypass the API by calling Supabase directly with their own token.
In that case replace that policy with an admin-only one. Referees never need direct write access: Start Match and
Edit Score go through the service-role API routes above.
