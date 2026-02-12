import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'

/**
 * 分を「X時間Y分」形式に変換
 */
export function formatMinutesToHours(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}分`
  if (mins === 0) return `${hours}時間`
  return `${hours}時間${mins}分`
}

/**
 * 金額をフォーマット
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
  }).format(amount)
}

/**
 * 日付をフォーマット
 */
export function formatDate(dateStr: string, formatStr: string = 'yyyy/MM/dd'): string {
  return format(parseISO(dateStr), formatStr, { locale: ja })
}

/**
 * 時刻をフォーマット
 */
export function formatTime(dateStr: string | null): string {
  if (!dateStr) return '--:--'
  return format(parseISO(dateStr), 'HH:mm')
}

/**
 * 今月のYYYY-MM形式の文字列を取得
 */
export function getCurrentYearMonth(): string {
  return format(new Date(), 'yyyy-MM')
}

/**
 * classNameの結合ユーティリティ
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
