type WorkEntry = {
  store_id: string
  work_minutes: number | null
  clock_in?: string | null
  clock_out?: string | null
  break1_start?: string | null
  break1_end?: string | null
  break2_start?: string | null
  break2_end?: string | null
  break3_start?: string | null
  break3_end?: string | null
}

export type StoreHourlyWageRow = {
  store_id: string
  hourly_wage: number
}

type TimeRange = {
  start: Date
  end: Date
}

export type PayBreakdown = {
  regularMinutes: number
  lateNightMinutes: number
  totalMinutes: number
  totalAmount: number
}

export type ShiftPayEntry = {
  shiftDate: string
  startTime: string | null
  endTime: string | null
  breakStartTime?: string | null
  breakEndTime?: string | null
}

const MINUTE_MS = 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const LATE_NIGHT_START_HOUR = 22
const LATE_NIGHT_END_HOUR = 5
const LATE_NIGHT_MULTIPLIER_NUMERATOR = 5
const LATE_NIGHT_MULTIPLIER_DENOMINATOR = 4

export function createHourlyWageMap(rows: StoreHourlyWageRow[] | null | undefined) {
  return new Map((rows || []).map((row) => [row.store_id, row.hourly_wage]))
}

export function getStoreHourlyWage(
  hourlyWageByStore: Map<string, number> | undefined,
  storeId: string,
  fallbackHourlyWage: number
) {
  return hourlyWageByStore?.get(storeId) ?? fallbackHourlyWage
}

function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / MINUTE_MS))
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS)
}

function parseTimestamp(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseJstDateTime(date: string, time: string | null | undefined) {
  if (!time) return null

  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null
  }

  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute, 0, 0))
}

function getJstDayStart(date: Date) {
  const jst = new Date(date.getTime() + JST_OFFSET_MS)
  return new Date(
    Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate(), -9, 0, 0, 0)
  )
}

function getLateNightWindows(start: Date, end: Date) {
  const windows: TimeRange[] = []
  let dayStart = addDays(getJstDayStart(start), -1)
  const lastDayStart = addDays(getJstDayStart(end), 1)

  while (dayStart <= lastDayStart) {
    const lateNightStart = new Date(dayStart.getTime() + LATE_NIGHT_START_HOUR * 60 * MINUTE_MS)
    const lateNightEnd = new Date(
      addDays(dayStart, 1).getTime() + LATE_NIGHT_END_HOUR * 60 * MINUTE_MS
    )
    windows.push({ start: lateNightStart, end: lateNightEnd })
    dayStart = addDays(dayStart, 1)
  }

  return windows
}

function overlapMinutes(range: TimeRange, target: TimeRange) {
  const start = Math.max(range.start.getTime(), target.start.getTime())
  const end = Math.min(range.end.getTime(), target.end.getTime())
  return Math.max(0, Math.round((end - start) / MINUTE_MS))
}

function subtractBreaks(workRange: TimeRange, breaks: TimeRange[]) {
  let segments = [workRange]

  for (const breakRange of breaks) {
    if (breakRange.end <= breakRange.start) continue

    segments = segments.flatMap((segment) => {
      const overlapStart = Math.max(segment.start.getTime(), breakRange.start.getTime())
      const overlapEnd = Math.min(segment.end.getTime(), breakRange.end.getTime())

      if (overlapStart >= overlapEnd) return [segment]

      const nextSegments: TimeRange[] = []
      if (segment.start.getTime() < overlapStart) {
        nextSegments.push({ start: segment.start, end: new Date(overlapStart) })
      }
      if (overlapEnd < segment.end.getTime()) {
        nextSegments.push({ start: new Date(overlapEnd), end: segment.end })
      }
      return nextSegments
    })
  }

  return segments
}

function calculatePayFromSegments(segments: TimeRange[], hourlyWage: number): PayBreakdown {
  let regularMinutes = 0
  let lateNightMinutes = 0

  for (const segment of segments) {
    const totalSegmentMinutes = minutesBetween(segment.start, segment.end)
    const segmentLateNightMinutes = getLateNightWindows(segment.start, segment.end).reduce(
      (sum, window) => sum + overlapMinutes(segment, window),
      0
    )

    lateNightMinutes += segmentLateNightMinutes
    regularMinutes += Math.max(0, totalSegmentMinutes - segmentLateNightMinutes)
  }

  const totalMinutes = regularMinutes + lateNightMinutes
  const totalAmount = calculatePayAmount(regularMinutes, lateNightMinutes, hourlyWage)

  return {
    regularMinutes,
    lateNightMinutes,
    totalMinutes,
    totalAmount,
  }
}

function calculatePayAmount(regularMinutes: number, lateNightMinutes: number, hourlyWage: number) {
  return Math.floor(
    (regularMinutes * hourlyWage * LATE_NIGHT_MULTIPLIER_DENOMINATOR +
      lateNightMinutes * hourlyWage * LATE_NIGHT_MULTIPLIER_NUMERATOR) /
      (60 * LATE_NIGHT_MULTIPLIER_DENOMINATOR)
  )
}

export function calculateAttendancePay(entry: WorkEntry, hourlyWage: number): PayBreakdown {
  const clockIn = parseTimestamp(entry.clock_in)
  const clockOut = parseTimestamp(entry.clock_out)

  if (!clockIn || !clockOut || clockOut <= clockIn) {
    const totalMinutes = entry.work_minutes || 0
    return {
      regularMinutes: totalMinutes,
      lateNightMinutes: 0,
      totalMinutes,
      totalAmount: Math.floor((totalMinutes / 60) * hourlyWage),
    }
  }

  const breakPairs: [string | null | undefined, string | null | undefined][] = [
    [entry.break1_start, entry.break1_end],
    [entry.break2_start, entry.break2_end],
    [entry.break3_start, entry.break3_end],
  ]
  const breaks = breakPairs.flatMap(([startValue, endValue]) => {
    const start = parseTimestamp(startValue)
    const end = parseTimestamp(endValue)
    return start && end ? [{ start, end }] : []
  })
  const segments = subtractBreaks({ start: clockIn, end: clockOut }, breaks)

  return calculatePayFromSegments(segments, hourlyWage)
}

export function calculateShiftPay(entry: ShiftPayEntry, hourlyWage: number): PayBreakdown {
  const start = parseJstDateTime(entry.shiftDate, entry.startTime)
  let end = parseJstDateTime(entry.shiftDate, entry.endTime)

  if (!start || !end) {
    return { regularMinutes: 0, lateNightMinutes: 0, totalMinutes: 0, totalAmount: 0 }
  }

  if (end <= start) end = addDays(end, 1)

  const breakStart = parseJstDateTime(entry.shiftDate, entry.breakStartTime)
  let breakEnd = parseJstDateTime(entry.shiftDate, entry.breakEndTime)
  const breaks: TimeRange[] = []

  if (breakStart && breakEnd) {
    let normalizedBreakStart = breakStart
    if (normalizedBreakStart < start) normalizedBreakStart = addDays(normalizedBreakStart, 1)
    if (breakEnd <= normalizedBreakStart) breakEnd = addDays(breakEnd, 1)
    breaks.push({ start: normalizedBreakStart, end: breakEnd })
  }

  const segments = subtractBreaks({ start, end }, breaks)
  return calculatePayFromSegments(segments, hourlyWage)
}

export function calculateBaseSalaryByStore(
  entries: WorkEntry[] | null | undefined,
  hourlyWageByStore: Map<string, number>,
  fallbackHourlyWage: number
) {
  const minutesByStore = new Map<string, { regularMinutes: number; lateNightMinutes: number }>()

  for (const entry of entries || []) {
    const hourlyWage = getStoreHourlyWage(hourlyWageByStore, entry.store_id, fallbackHourlyWage)
    const pay = calculateAttendancePay(entry, hourlyWage)
    const current = minutesByStore.get(entry.store_id) || {
      regularMinutes: 0,
      lateNightMinutes: 0,
    }

    minutesByStore.set(entry.store_id, {
      regularMinutes: current.regularMinutes + pay.regularMinutes,
      lateNightMinutes: current.lateNightMinutes + pay.lateNightMinutes,
    })
  }

  return Array.from(minutesByStore.entries()).reduce((total, [storeId, minutes]) => {
    const hourlyWage = getStoreHourlyWage(hourlyWageByStore, storeId, fallbackHourlyWage)
    return total + calculatePayAmount(minutes.regularMinutes, minutes.lateNightMinutes, hourlyWage)
  }, 0)
}
