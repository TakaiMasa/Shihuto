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
  // Update the legacy fallback wage, then initialize all store-specific wages.
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ hourly_wage: input.hourly_wage })
    .eq('id', authData.user.id)

  if (profileError) {
    return { error: profileError.message }
  }

  const { data: stores, error: storesError } = await supabaseAdmin
    .from('stores')
    .select('id')

  if (storesError) {
    return { error: storesError.message }
  }

  if (stores && stores.length > 0) {
    const { error: wagesError } = await supabaseAdmin
      .from('staff_store_hourly_wages')
      .upsert(
        stores.map((store) => ({
          user_id: authData.user.id,
          store_id: store.id,
          hourly_wage: input.hourly_wage,
        })),
        { onConflict: 'user_id,store_id' }
      )

    if (wagesError) {
      return { error: wagesError.message }
    }
  }

  return { success: true, userId: authData.user.id }
}
