import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedAccountingRequest } from '@/lib/api/accounting-auth'
import { createServiceClient } from '@/lib/supabase/service'

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

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { error: 'Failed to load staff', detail: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      count: data.length,
      includeInactive,
      items: data,
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
