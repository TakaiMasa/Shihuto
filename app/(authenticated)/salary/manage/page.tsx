'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/auth-provider'
import { format, addMonths, endOfMonth } from 'date-fns'
import { ja } from 'date-fns/locale'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Calculator,
  FileText,
  Check,
  CheckCircle,
} from 'lucide-react'
import { cn, formatCurrency, formatMinutesToHours } from '@/lib/utils'
import type { Salary, Profile } from '@/lib/types'

export default function SalaryManagePage() {
  const { supabase } = useAuth()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [salaries, setSalaries] = useState<(Salary & { profiles: Profile })[]>([])
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const yearMonth = format(currentMonth, 'yyyy-MM')

  const fetchSalaries = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('salaries')
      .select('*, profiles(name)')
      .eq('year_month', yearMonth)
      .order('total_salary', { ascending: false })

    setSalaries((data || []) as any)
    setLoading(false)
  }, [yearMonth, supabase])

  useEffect(() => {
    fetchSalaries()
  }, [fetchSalaries])

  const handleCalculate = async () => {
    setCalculating(true)
    setMessage({ type: '', text: '' })

    // アクティブなスタッフを取得
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)

    // 店舗情報を取得
    const { data: storesData } = await supabase
      .from('stores')
      .select('*')

    const shikiStore = storesData?.find((s) => s.code === 'shiki')

    if (!profiles || !storesData) {
      setMessage({ type: 'error', text: 'データの取得に失敗しました' })
      setCalculating(false)
      return
    }

    // 各スタッフの勤怠データを取得して給与を計算
    for (const profile of profiles) {
      const { data: attendances } = await supabase
        .from('attendances')
        .select('*, stores(code)')
        .eq('user_id', profile.id)
        .gte('work_date', `${yearMonth}-01`)
        .lte('work_date', format(endOfMonth(currentMonth), 'yyyy-MM-dd'))
        .not('clock_out', 'is', null)

      const totalWorkMinutes = attendances?.reduce((sum, a) => sum + (a.work_minutes || 0), 0) || 0
      const totalBreakMinutes = attendances?.reduce((sum, a) => sum + (a.break_minutes || 0), 0) || 0
      const shikiDays = attendances?.filter((a: any) => a.stores?.code === 'shiki').length || 0
      const transportationFeePerDay = profile.transportation_fee || 0
      const baseSalary = Math.floor(totalWorkMinutes / 60 * profile.hourly_wage)
      const transportationTotal = shikiDays * transportationFeePerDay
      const totalSalary = baseSalary + transportationTotal

      // UPSERT
      await supabase
        .from('salaries')
        .upsert(
          {
            user_id: profile.id,
            year_month: yearMonth,
            total_work_minutes: totalWorkMinutes,
            total_break_minutes: totalBreakMinutes,
            hourly_wage: profile.hourly_wage,
            work_days_shiki: shikiDays,
            transportation_fee_per_day: transportationFeePerDay,
            base_salary: baseSalary,
            transportation_total: transportationTotal,
            total_salary: totalSalary,
          },
          { onConflict: 'user_id,year_month' }
        )
    }

    setMessage({ type: 'success', text: '給与計算が完了しました' })
    setCalculating(false)
    fetchSalaries()
  }

  const handleConfirm = async (salaryId: string) => {
    await supabase
      .from('salaries')
      .update({ is_confirmed: true })
      .eq('id', salaryId)
    fetchSalaries()
  }

  const handleConfirmAll = async () => {
    const unconfirmed = salaries.filter((s) => !s.is_confirmed)
    for (const s of unconfirmed) {
      await supabase
        .from('salaries')
        .update({ is_confirmed: true })
        .eq('id', s.id)
    }
    fetchSalaries()
  }

  const handleExportPdf = async (salary: Salary & { profiles: Profile }) => {
    const { default: jsPDF } = await import('jspdf')

    const doc = new jsPDF()

    // フォントサイズと位置の設定
    doc.setFontSize(18)
    doc.text('Salary Statement', 20, 25)

    doc.setFontSize(10)
    doc.text(`Period: ${salary.year_month}`, 20, 35)
    doc.text(`Staff: ${salary.profiles?.name || 'Unknown'}`, 20, 42)

    // テーブル風の表示
    let y = 55
    const items = [
      ['Total Work Time', formatMinutesToHours(salary.total_work_minutes)],
      ['Total Break Time', formatMinutesToHours(salary.total_break_minutes)],
      ['Hourly Wage', `${salary.hourly_wage} JPY`],
      ['Base Salary', `${salary.base_salary} JPY`],
      ['Shiki Work Days', `${salary.work_days_shiki} days`],
      ['Transportation Fee/Day', `${salary.transportation_fee_per_day} JPY`],
      ['Transportation Total', `${salary.transportation_total} JPY`],
      ['Total Salary', `${salary.total_salary} JPY`],
    ]

    doc.setFontSize(10)
    items.forEach(([label, value]) => {
      doc.text(label, 20, y)
      doc.text(value, 130, y, { align: 'right' })
      y += 8
    })

    // 線
    doc.setLineWidth(0.5)
    doc.line(20, y - 3, 130, y - 3)

    doc.setFontSize(12)
    doc.text('TOTAL', 20, y + 5)
    doc.text(`${salary.total_salary} JPY`, 130, y + 5, { align: 'right' })

    doc.save(`salary_${salary.year_month}_${salary.profiles?.name || 'staff'}.pdf`)
  }

  const totalAmount = salaries.reduce((sum, s) => sum + s.total_salary, 0)

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">給与管理</h1>
      <p className="text-secondary text-sm mb-6">給与の計算・確定・PDF出力ができます</p>

      {message.text && (
        <div
          className={cn(
            'mb-4 p-3 rounded-lg text-sm',
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          )}
        >
          {message.text}
        </div>
      )}

      <div className="bg-card rounded-xl border border-border shadow-sm">
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 border-b border-border gap-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-foreground">
                {format(currentMonth, 'yyyy年M月', { locale: ja })}
              </h2>
              <p className="text-xs text-secondary">
                人件費合計: {formatCurrency(totalAmount)}
              </p>
            </div>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCalculate}
              disabled={calculating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-all"
            >
              {calculating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Calculator size={16} />
              )}
              {calculating ? '計算中...' : '給与計算'}
            </button>
            {salaries.some((s) => !s.is_confirmed) && (
              <button
                onClick={handleConfirmAll}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-success text-white text-sm font-medium hover:opacity-90 transition-all"
              >
                <CheckCircle size={16} />
                一括確定
              </button>
            )}
          </div>
        </div>

        {/* テーブル */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : salaries.length === 0 ? (
            <div className="text-center py-20 text-secondary">
              <Calculator size={48} className="mx-auto text-secondary/30 mb-4" />
              <p>給与データがありません</p>
              <p className="text-xs mt-2">「給与計算」ボタンで計算を実行してください</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-secondary">スタッフ</th>
                  <th className="px-4 py-3 text-center font-medium text-secondary">勤務時間</th>
                  <th className="px-4 py-3 text-center font-medium text-secondary">時給</th>
                  <th className="px-4 py-3 text-center font-medium text-secondary">基本給</th>
                  <th className="px-4 py-3 text-center font-medium text-secondary">四季日数</th>
                  <th className="px-4 py-3 text-center font-medium text-secondary">交通費</th>
                  <th className="px-4 py-3 text-center font-medium text-secondary">総支給額</th>
                  <th className="px-4 py-3 text-center font-medium text-secondary">状態</th>
                  <th className="px-4 py-3 text-center font-medium text-secondary">操作</th>
                </tr>
              </thead>
              <tbody>
                {salaries.map((salary) => (
                  <tr key={salary.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {salary.profiles?.name}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {formatMinutesToHours(salary.total_work_minutes)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {formatCurrency(salary.hourly_wage)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {formatCurrency(salary.base_salary)}
                    </td>
                    <td className="px-4 py-3 text-center">{salary.work_days_shiki}日</td>
                    <td className="px-4 py-3 text-center">
                      {formatCurrency(salary.transportation_total)}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-primary">
                      {formatCurrency(salary.total_salary)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {salary.is_confirmed ? (
                        <span className="px-2 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                          確定
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
                          未確定
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {!salary.is_confirmed && (
                          <button
                            onClick={() => handleConfirm(salary.id)}
                            className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100"
                            title="確定"
                          >
                            <Check size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleExportPdf(salary)}
                          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
                          title="PDF出力"
                        >
                          <FileText size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/50 font-semibold">
                  <td className="px-4 py-3">合計</td>
                  <td className="px-4 py-3 text-center">
                    {formatMinutesToHours(salaries.reduce((s, v) => s + v.total_work_minutes, 0))}
                  </td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-center">
                    {formatCurrency(salaries.reduce((s, v) => s + v.base_salary, 0))}
                  </td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-center">
                    {formatCurrency(salaries.reduce((s, v) => s + v.transportation_total, 0))}
                  </td>
                  <td className="px-4 py-3 text-center text-primary">
                    {formatCurrency(totalAmount)}
                  </td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
