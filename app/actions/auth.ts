'use server'

import { createClient } from '@supabase/supabase-js'

interface CreateStaffInput {
  email: string
  password: string
  name: string
  role: 'staff' | 'admin'
  hourly_wage: number
}

export async function createStaffUser(input: CreateStaffInput) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Create user with admin API (does not replace the current session)
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        name: input.name,
        role: input.role,
      },
    })

  if (authError) {
    return { error: authError.message }
  }

  // The handle_new_user trigger creates the profile with name and role.
  // Update remaining fields (hourly_wage).
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ hourly_wage: input.hourly_wage })
    .eq('id', authData.user.id)

  if (profileError) {
    return { error: profileError.message }
  }

  return { success: true, userId: authData.user.id }
}
