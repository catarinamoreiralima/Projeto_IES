# Admin user management (Supabase)

This project keeps end-user signup disabled in the browser UI.

Use this script for admin-only user onboarding:

- `scripts/manage_supabase_user.js`

## Install dependency

```bash
npm install @supabase/supabase-js
```

## Invite user (Supabase sends invite email)

```bash
node scripts/manage_supabase_user.js invite user@example.com https://YOUR_PROJECT.supabase.co YOUR_SERVICE_ROLE_KEY
```

## Create user directly (no invite flow)

```bash
node scripts/manage_supabase_user.js create user@example.com https://YOUR_PROJECT.supabase.co YOUR_SERVICE_ROLE_KEY --password "StrongPass123!"
```

Optional for `create`: do not auto-confirm email

```bash
node scripts/manage_supabase_user.js create user@example.com https://YOUR_PROJECT.supabase.co YOUR_SERVICE_ROLE_KEY --password "StrongPass123!" --no-email-confirm
```

## Security notes

- Never expose `SERVICE_ROLE_KEY` in client code.
- Run scripts locally or on a secure admin server only.
- Rotate keys if you suspect leakage.
