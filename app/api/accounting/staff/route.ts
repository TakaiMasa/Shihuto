import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedAccountingRequest } from '@/lib/api/accounting-auth'
import { createServiceClient } from '@/lib/supabase/service'

type StoreHourlyWageApiItem = {
  store_id: string
  hourly_wage: number
  store: unknown
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorizedAccountingRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true'

    const supabase = createServiceClient()

    let query = supabase
      .from('profiles')
      .select('id,name,role,hourly_wage,transportation_fee,is_active,created_at,updated_at')
      .order('name', { ascending: true })

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const [{ data, error }, { data: wages, error: wagesError }] = await Promise.all([
      query,
      supabase
        .from('staff_store_hourly_wages')
        .select('user_id,store_id,hourly_wage,stores(name,code)'),
    ])

    if (error) {
      return NextResponse.json(
        { error: 'Failed to load staff', detail: error.message },
        { status: 500 }
      )
    }

    if (wagesError) {
      return NextResponse.json(
        { error: 'Failed to load hourly wages', detail: wagesError.message },
        { status: 500 }
      )
    }

    const wagesByUser = new Map<string, StoreHourlyWageApiItem[]>()
    for (const wage of wages || []) {
      const store = Array.isArray(wage.stores) ? wage.stores[0] ?? null : wage.stores
      const userWages = wagesByUser.get(wage.user_id) || []
      userWages.push({
        store_id: wage.store_id,
        hourly_wage: wage.hourly_wage,
        store,
      })
      wagesByUser.set(wage.user_id, userWages)
    }

    const items = (data || []).map((profile) => ({
      ...profile,
      store_hourly_wages: wagesByUser.get(profile.id) || [],
    }))

    return NextResponse.json({
      count: items.length,
      includeInactive,
      items,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Server configuration error',
        detail: error instanceof Error ? error.message : 'unknown',
      },
      { status: 500 }
    )
  }
}
