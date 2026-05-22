#!/usr/bin/env node
// Delete a Supabase user by email using the service_role key.
// Usage:
//   npm install @supabase/supabase-js
//   node scripts/delete_supabase_user.js user@example.com https://xyz.supabase.co SERVICE_ROLE_KEY

const { createClient } = require('@supabase/supabase-js')

const [,, email, supabaseUrl, serviceRoleKey] = process.argv

if (!email || !supabaseUrl || !serviceRoleKey) {
  console.error('Usage: node scripts/delete_supabase_user.js EMAIL SUPABASE_URL SERVICE_ROLE_KEY')
  process.exit(1)
}

async function main() {
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // List users and find by email
  const { data: listData, error: listErr } = await supabase.auth.admin.listUsers()
  if (listErr) {
    console.error('Error listing users:', listErr)
    process.exit(1)
  }

  const user = (listData && listData.users || []).find(u => u.email && u.email.toLowerCase() === email.toLowerCase())
  if (!user) {
    console.error('User not found for email:', email)
    process.exit(1)
  }

  const uid = user.id
  const { error: delErr } = await supabase.auth.admin.deleteUser(uid)
  if (delErr) {
    console.error('Error deleting user:', delErr)
    process.exit(1)
  }

  console.log('Deleted user', email, '-> uid:', uid)
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
