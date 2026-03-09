export function isYearMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

export function isDateString(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)
}
