'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/auth-provider'
import { format, addMonths, endOfMonth } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Loader2, Wallet } from 'lucide-react'
import { formatCurrency, formatMinutesToHours, formatDate } from '@/lib/utils'
import type { Salary } from '@/lib/types'

export default function SalaryViewPage() {
  const { user, supabase } = useAuth()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [salary, setSalary] = useState<Salary | null>(null)
  const [attendances, setAttendances] = useState<any[]>([])
  const [feeByStore, setFeeByStore] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)

  const yearMonth = format(currentMonth, 'yyyy-MM')

  const fetchSalary = useCallback(async () => {
    setLoading(true)

    const [{ data: salaryData }, { data: attendanceData }, { data: feesData }] = await Promise.all([
      supabase
        .from('salaries')
        .select('*')
        .eq('user_id', user.id)
        .eq('year_month', yearMonth)
        .single(),
      supabase
        .from('attendances')
        .select('*, stores(name)')
        .eq('user_id', user.id)
        .gte('work_date', `${yearMonth}-01`)
        .lte('work_date', format(endOfMonth(new Date(`${yearMonth}-01`)), 'yyyy-MM-dd'))
        .not('clock_out', 'is', null)
        .order('work_date', { ascending: true }),
      supabase
        .from('staff_transportation_fees')
        .select('store_id, fee')
        .eq('user_id', user.id),
    ])

    setSalary(salaryData as Salary | null)
    setAttendances(attendanceData || [])
    setFeeByStore(new Map(feesData?.map((f) => [f.store_id, f.fee]) || []))
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
        <div className="max-w-lg mx-auto space-y-4">
          {/* 月次サマリー */}
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
                <span className="text-secondary">交通費対象 出勤日数</span>
                <span className="font-medium text-foreground">{salary.work_days_shiki}日</span>
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

          {/* 日別内訳 */}
          {attendances.length > 0 && (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="font-semibold text-foreground text-sm">日別内訳</h3>
              </div>
              <div className="divide-y divide-border">
                {attendances.map((att) => {
                  const dailyBase = Math.floor(
                    (att.work_minutes || 0) / 60 * salary.hourly_wage
                  )
                  const dailyTransport = feeByStore.get(att.store_id) || 0
                  const dailyTotal = dailyBase + dailyTransport
                  return (
                    <div key={att.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {formatDate(att.work_date, 'M月d日(E)')}
                        </p>
                        <p className="text-xs text-secondary mt-0.5">
                          {att.stores?.name || '-'} · {formatMinutesToHours(att.work_minutes || 0)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-primary">{formatCurrency(dailyTotal)}</p>
                        {dailyTransport > 0 && (
                          <p className="text-xs text-secondary mt-0.5">
                            交通費 +{formatCurrency(dailyTransport)}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
