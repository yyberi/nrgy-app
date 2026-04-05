const HELSINKI_TZ = 'Europe/Helsinki'

function getOffsetMinutes(timeZone: string, date: Date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  const parts = dtf.formatToParts(date)
  const lookup = Object.fromEntries(parts.map(part => [part.type, part.value]))
  const year = Number(lookup.year)
  const month = Number(lookup.month)
  const day = Number(lookup.day)
  const hour = Number(lookup.hour)
  const minute = Number(lookup.minute)
  const second = Number(lookup.second)
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  return (asUtc - date.getTime()) / 60000
}

export function helsinkiDateToUtcMs(dateStr: string) {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return Number.NaN
  const [, yearStr, monthStr, dayStr] = match
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return Number.NaN
  let utcMs = Date.UTC(year, month - 1, day, 0, 0, 0)
  for (let i = 0; i < 3; i += 1) {
    const offsetMinutes = getOffsetMinutes(HELSINKI_TZ, new Date(utcMs))
    const candidate = Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMinutes * 60 * 1000
    if (candidate === utcMs) break
    utcMs = candidate
  }
  return utcMs
}
