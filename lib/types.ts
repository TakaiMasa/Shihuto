export type UserRole = 'staff' | 'admin'

export interface Store {
  id: string
  name: string
  code: string
  has_transportation_fee: boolean
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  name: string
  role: UserRole
  hourly_wage: number
  transportation_fee: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ShiftUnavailable {
  id: string
  user_id: string
  unavailable_date: string
  created_at: string
}

export interface Shift {
  id: string
  user_id: string
  store_id: string
  shift_date: string
  created_at: string
  updated_at: string
  // JOIN用
  profiles?: Profile
  stores?: Store
}

export interface Attendance {
  id: string
  user_id: string
  store_id: string
  work_date: string
  clock_in: string | null
  break_start: string | null
  break_end: string | null
  clock_out: string | null
  work_minutes: number | null
  break_minutes: number | null
  memo: string | null
  created_at: string
  updated_at: string
  // JOIN用
  profiles?: Profile
  stores?: Store
}

export interface Salary {
  id: string
  user_id: string
  year_month: string
  total_work_minutes: number
  total_break_minutes: number
  hourly_wage: number
  work_days_shiki: number
  transportation_fee_per_day: number
  base_salary: number
  transportation_total: number
  total_salary: number
  is_confirmed: boolean
  created_at: string
  updated_at: string
  // JOIN用
  profiles?: Profile
}
