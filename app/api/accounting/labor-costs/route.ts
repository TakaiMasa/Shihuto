import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedAccountingRequest } from '@/lib/api/accounting-auth'
import { createServiceClient } from '@/lib/supabase/service'

function isYearMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorizedAccountingRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const yearMonth = request.nextUrl.searchParams.get('yearMonth')

    if (!yearMonth || !isYearMonth(yearMonth)) {
      return NextResponse.json(
        { error: 'yearMonth is required in YYYY-MM format' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('salaries')
      .select('id,user_id,year_month,total_work_minutes,total_break_minutes,hourly_wage,work_days_shiki,transportation_fee_per_day,base_salary,transportation_total,total_salary,is_confirmed,profiles(name)')
      .eq('year_month', yearMonth)
      .order('total_salary', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to load labor costs', detail: error.message },
        { status: 500 }
      )
    }

    const totalLaborCost = data.reduce((sum, row) => sum + (row.total_salary || 0), 0)

    return NextResponse.json({
      yearMonth,
      totalLaborCost,
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
