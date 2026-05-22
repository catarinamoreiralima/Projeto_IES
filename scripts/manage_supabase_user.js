#!/usr/bin/env node
// Admin utility: invite or create a Supabase auth user using SERVICE_ROLE key.
//
// Usage examples:
//   node scripts/manage_supabase_user.js invite user@example.com https://xyz.supabase.co SERVICE_ROLE_KEY
//   node scripts/manage_supabase_user.js create user@example.com https://xyz.supabase.co SERVICE_ROLE_KEY --password "StrongPass123!"
//   node scripts/manage_supabase_user.js create user@example.com https://xyz.supabase.co SERVICE_ROLE_KEY --password "StrongPass123!" --no-email-confirm

const { createClient } = require('@supabase/supabase-js')

const [, , mode, email, supabaseUrl, serviceRoleKey, ...rest] = process.argv

function usage() {
  console.error('Usage:')
  console.error('  invite: node scripts/manage_supabase_user.js invite EMAIL SUPABASE_URL SERVICE_ROLE_KEY')
  console.error('  create: node scripts/manage_supabase_user.js create EMAIL SUPABASE_URL SERVICE_ROLE_KEY --password "PASSWORD" [--no-email-confirm]')
  process.exit(1)
}

function parseArgs(args) {
  const out = {
    password: '',
    emailConfirm: true,
  }

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i]
    if (token === '--password') {
      out.password = String(args[i + 1] || '')
      i += 1
      continue
    }
    if (token === '--no-email-confirm') {
      out.emailConfirm = false
      continue
    }
  }

  return out
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

async function findUserByEmail(supabase, targetEmail) {
  const { data, error } = await supabase.auth.admin.listUsers()
  if (error) throw error
  const users = (data && data.users) || []
  return users.find((u) => normalizeEmail(u.email) === targetEmail) || null
}

async function runInvite(supabase, targetEmail) {
  const existing = await findUserByEmail(supabase, targetEmail)
  if (existing) {
    console.log('User already exists:', targetEmail, 'uid:', existing.id)
    return
  }

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(targetEmail)
  if (error) throw error

  console.log('Invite sent to', targetEmail)
  if (data && data.user && data.user.id) {
    console.log('Created auth user id:', data.user.id)
  }
}

async function runCreate(supabase, targetEmail, options) {
  if (!options.password) {
    console.error('Missing --password for create mode')
    usage()
  }

  const existing = await findUserByEmail(supabase, targetEmail)
  if (existing) {
    console.log('User already exists:', targetEmail, 'uid:', existing.id)
    return
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: targetEmail,
    password: options.password,
    email_confirm: options.emailConfirm,
  })
  if (error) throw error

  console.log('User created:', targetEmail)
  if (data && data.user && data.user.id) {
    console.log('Auth user id:', data.user.id)
  }
  console.log('email_confirm:', options.emailConfirm)
}

async function main() {
  if (!mode || !email || !supabaseUrl || !serviceRoleKey) usage()

  const normalizedMode = String(mode).trim().toLowerCase()
  const targetEmail = normalizeEmail(email)

  if (!targetEmail || !targetEmail.includes('@')) {
    console.error('Invalid email:', email)
    process.exit(1)
  }

  if (normalizedMode !== 'invite' && normalizedMode !== 'create') {
    console.error('Invalid mode:', mode)
    usage()
  }

  const opts = parseArgs(rest)
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  if (normalizedMode === 'invite') {
    await runInvite(supabase, targetEmail)
    return
  }

  await runCreate(supabase, targetEmail, opts)
}

main().catch((err) => {
  const status = err && err.status ? ` (status ${err.status})` : ''
  const message = err && err.message ? err.message : String(err)
  console.error('Error:', `${message}${status}`)
  process.exit(1)
})
