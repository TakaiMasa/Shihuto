'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/auth-provider'
import { format, addMonths } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Loader2, Wallet } from 'lucide-react'
import { formatCurrency, formatMinutesToHours } from '@/lib/utils'
import type { Salary } from '@/lib/types'

export default function SalaryViewPage() {
  const { user, supabase } = useAuth()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [salary, setSalary] = useState<Salary | null>(null)
  const [loading, setLoading] = useState(true)

  const yearMonth = format(currentMonth, 'yyyy-MM')

  const fetchSalary = useCallback(async () => {
    setLoading(true)

    const { data } = await supabase
      .from('salaries')
      .select('*')
      .eq('user_id', user.id)
      .eq('year_month', yearMonth)
      .single()

    setSalary(data as Salary | null)
    setLoading(false)
  }, [yearMonth, supabase, user.id])

  useEffect(() => {
    fetchSalary()
  }, [fetchSalary])

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">給与確認</h1>
      <p className="text-secondary text-sm mb-6">月ごとの給与明細を確認できます</p>

      {/* 月切り替え */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-lg font-semibold text-foreground">
          {format(currentMonth, 'yyyy年M月', { locale: ja })}
        </h2>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : !salary ? (
        <div className="bg-card rounded-xl border border-border shadow-sm p-12 text-center">
          <Wallet size={48} className="mx-auto text-secondary/30 mb-4" />
          <p className="text-secondary">この月の給与データはまだありません</p>
          <p className="text-xs text-secondary mt-2">管理者が給与計算を行うと表示されます</p>
        </div>
      ) : (
        <div className="max-w-lg mx-auto">
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            {/* ヘッダー */}
            <div className="bg-primary px-6 py-5 text-white">
              <p className="text-sm opacity-80">総支給額</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(salary.total_salary)}</p>
              {salary.is_confirmed && (
                <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-white/20 text-xs">
                  確定済み
                </span>
              )}
            </div>

            {/* 詳細 */}
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-secondary">総勤務時間</span>
                <span className="font-medium text-foreground">
                  {formatMinutesToHours(salary.total_work_minutes)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-secondary">総休憩時間</span>
                <span className="font-medium text-foreground">
                  {formatMinutesToHours(salary.total_break_minutes)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-secondary">時給</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(salary.hourly_wage)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-secondary">基本給</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(salary.base_salary)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-secondary">麺屋四季 出勤日数</span>
                <span className="font-medium text-foreground">{salary.work_days_shiki}日</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-secondary">交通費（1回あたり）</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(salary.transportation_fee_per_day)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-secondary">交通費合計</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(salary.transportation_total)}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 bg-muted -mx-6 px-6 rounded-lg mt-4">
                <span className="font-semibold text-foreground">総支給額</span>
                <span className="font-bold text-lg text-primary">
                  {formatCurrency(salary.total_salary)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
