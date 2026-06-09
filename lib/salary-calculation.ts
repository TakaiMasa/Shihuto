import { endOfMonth, format } from 'date-fns'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types'
import { calculateBaseSalaryByStore, createHourlyWageMap } from '@/lib/wages'

type SalaryAttendance = {
  store_id: string
  work_minutes: number | null
  break_minutes: number | null
  clock_in: string | null
  clock_out: string | null
  break1_start: string | null
  break1_end: string | null
  break2_start: string | null
  break2_end: string | null
  break3_start: string | null
  break3_end: string | null
}

type StaffTransportationFeeRow = {
  user_id: string
  store_id: string
  fee: number
}

type StaffStoreHourlyWageRow = {
  user_id: string
  store_id: string
  hourly_wage: number
}

type ExistingSalaryRow = {
  user_id: string
  is_confirmed: boolean
}

type CalculateMonthlySalariesOptions = {
  includeConfirmed?: boolean
}

export type CalculateMonthlySalariesResult = {
  calculatedCount: number
  skippedConfirmedCount: number
}

function throwSupabaseError(action: string, error: { message?: string } | null) {
  if (error) {
    throw new Error(`${action}: ${error.message || 'unknown error'}`)
  }
}

export async function calculateMonthlySalaries(
  supabase: SupabaseClient,
  yearMonth: string,
  monthDate: Date,
  options: CalculateMonthlySalariesOptions = {}
): Promise<CalculateMonthlySalariesResult> {
  const monthEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd')

  const [
    { data: profiles, error: profilesError },
    { data: allStaffFees, error: feesError },
    { data: allStaffWages, error: wagesError },
    { data: existingSalaries, error: existingSalariesError },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('is_active', true),
    supabase.from('staff_transportation_fees').select('user_id, store_id, fee'),
    supabase.from('staff_store_hourly_wages').select('user_id, store_id, hourly_wage'),
    supabase.from('salaries').select('user_id, is_confirmed').eq('year_month', yearMonth),
  ])

  throwSupabaseError('スタッフ情報の取得に失敗しました', profilesError)
  throwSupabaseError('交通費設定の取得に失敗しました', feesError)
  throwSupabaseError('時給設定の取得に失敗しました', wagesError)
  throwSupabaseError('既存給与の取得に失敗しました', existingSalariesError)

  const confirmedUserIds = new Set(
    ((existingSalaries || []) as ExistingSalaryRow[])
      .filter((salary) => salary.is_confirmed)
      .map((salary) => salary.user_id)
  )

  let calculatedCount = 0
  let skippedConfirmedCount = 0

  for (const profile of (profiles || []) as Profile[]) {
    if (!options.includeConfirmed && confirmedUserIds.has(profile.id)) {
      skippedConfirmedCount += 1
      continue
    }

    const { data: attendances, error: attendancesError } = await supabase
      .from('attendances')
      .select('*, stores(code)')
      .eq('user_id', profile.id)
      .gte('work_date', `${yearMonth}-01`)
      .lte('work_date', monthEnd)
      .not('clock_out', 'is', null)

    throwSupabaseError(`${profile.name} の勤怠データ取得に失敗しました`, attendancesError)

    const profileFees =
      ((allStaffFees || []) as StaffTransportationFeeRow[]).filter(
        (fee) => fee.user_id === profile.id
      )
    const feeByStore = new Map(profileFees.map((fee) => [fee.store_id, fee.fee]))
    const profileWages =
      ((allStaffWages || []) as StaffStoreHourlyWageRow[]).filter(
        (wage) => wage.user_id === profile.id
      )
    const wageByStore = createHourlyWageMap(profileWages)

    const attendanceRows = (attendances || []) as SalaryAttendance[]
    const totalWorkMinutes = attendanceRows.reduce(
      (sum, attendance) => sum + (attendance.work_minutes || 0),
      0
    )
    const totalBreakMinutes = attendanceRows.reduce(
      (sum, attendance) => sum + (attendance.break_minutes || 0),
      0
    )
    const transportDays = attendanceRows.filter(
      (attendance) => (feeByStore.get(attendance.store_id) || 0) > 0
    ).length
    const transportationTotal = attendanceRows.reduce(
      (sum, attendance) => sum + (feeByStore.get(attendance.store_id) || 0),
      0
    )
    const baseSalary = calculateBaseSalaryByStore(
      attendanceRows,
      wageByStore,
      profile.hourly_wage
    )
    const totalSalary = baseSalary + transportationTotal

    const { error: upsertError } = await supabase.from('salaries').upsert(
      {
        user_id: profile.id,
        year_month: yearMonth,
        total_work_minutes: totalWorkMinutes,
        total_break_minutes: totalBreakMinutes,
        hourly_wage: profile.hourly_wage,
        work_days_shiki: transportDays,
        transportation_fee_per_day: 0,
        base_salary: baseSalary,
        transportation_total: transportationTotal,
        total_salary: totalSalary,
      },
      { onConflict: 'user_id,year_month' }
    )

    throwSupabaseError(`${profile.name} の給与保存に失敗しました`, upsertError)
    calculatedCount += 1
  }

  return {
    calculatedCount,
    skippedConfirmedCount,
  }
}
