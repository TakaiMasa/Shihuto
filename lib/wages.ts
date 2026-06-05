type WorkEntry = {
  store_id: string
  work_minutes: number | null
}

export type StoreHourlyWageRow = {
  store_id: string
  hourly_wage: number
}

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

export function calculateBaseSalaryByStore(
  entries: WorkEntry[] | null | undefined,
  hourlyWageByStore: Map<string, number>,
  fallbackHourlyWage: number
) {
  const minutesByStore = new Map<string, number>()

  for (const entry of entries || []) {
    minutesByStore.set(
      entry.store_id,
      (minutesByStore.get(entry.store_id) || 0) + (entry.work_minutes || 0)
    )
  }

  return Array.from(minutesByStore.entries()).reduce((total, [storeId, minutes]) => {
    const hourlyWage = getStoreHourlyWage(hourlyWageByStore, storeId, fallbackHourlyWage)
    return total + Math.floor((minutes / 60) * hourlyWage)
  }, 0)
}
