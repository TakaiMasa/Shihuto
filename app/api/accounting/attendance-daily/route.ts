import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedAccountingRequest } from '@/lib/api/accounting-auth'
import { isDateString } from '@/lib/api/accounting-validators'
import { createServiceClient } from '@/lib/supabase/service'

type AttendanceAccountingRow = {
  user_id: string
  store_id: string
  work_minutes: number | null
  profiles?: { hourly_wage?: number | null } | null
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorizedAccountingRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const date = request.nextUrl.searchParams.get('date')
    const fromParam = request.nextUrl.searchParams.get('from')
    const toParam = request.nextUrl.searchParams.get('to')
    const storeId = request.nextUrl.searchParams.get('storeId')

    const from = date ?? fromParam
    const to = date ?? toParam

    if (!from || !to || !isDateString(from) || !isDateString(to)) {
      return NextResponse.json(
        { error: 'Use date=YYYY-MM-DD or from/to in YYYY-MM-DD format' },
        { status: 400 }
      )
    }

    if (from > to) {
      return NextResponse.json(
        { error: 'from must be earlier than or equal to to' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    let query = supabase
      .from('attendances')
      .select('id,user_id,store_id,work_date,clock_in,clock_out,work_minutes,break_minutes,memo,profiles(name,hourly_wage),stores(name,code)')
      .gte('work_date', from)
      .lte('work_date', to)
      .order('work_date', { ascending: true })

    if (storeId) {
      query = query.eq('store_id', storeId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { error: 'Failed to load attendance data', detail: error.message },
        { status: 500 }
      )
    }

    const { data: wages, error: wagesError } = await supabase
      .from('staff_store_hourly_wages')
      .select('user_id,store_id,hourly_wage')

    if (wagesError) {
      return NextResponse.json(
        { error: 'Failed to load hourly wages', detail: wagesError.message },
        { status: 500 }
      )
    }

    const rows = (data || []) as AttendanceAccountingRow[]
    const wageByStaffStore = new Map(
      (wages || []).map((wage) => [`${wage.user_id}:${wage.store_id}`, wage.hourly_wage])
    )
    const items = rows.map((row) => ({
      ...row,
      effective_hourly_wage:
        wageByStaffStore.get(`${row.user_id}:${row.store_id}`) ?? row.profiles?.hourly_wage ?? 0,
    }))
    const totalWorkMinutes = rows.reduce((sum, row) => sum + (row.work_minutes || 0), 0)

    return NextResponse.json({
      from,
      to,
      date,
      storeId,
      totalWorkMinutes,
      count: items.length,
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
