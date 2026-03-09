import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedAccountingRequest } from '@/lib/api/accounting-auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorizedAccountingRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('stores')
      .select('id,name,code,has_transportation_fee,base_day_of_week,created_at,updated_at')
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to load stores', detail: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      count: data.length,
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
