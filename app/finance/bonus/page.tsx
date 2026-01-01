"use client"

import { BonusSystem } from "@/components/finance/bonus-system"
import { useGlobalFinanceData } from "@/contexts/finance-data-context"
import { useNotification } from "@/hooks/use-notification"

export default function BonusPage() {
  const { students, teacherRecords, setTeacherRecords, expenses, setExpenses, bonusRules, setBonusRules, markDirty } =
    useGlobalFinanceData()
  const { notify } = useNotification()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">薪酬与分红</h1>
        <p className="text-gray-500 mt-1">团队成员收益统计与分红管理</p>
      </div>

      <BonusSystem
        students={students}
        teacherRecords={teacherRecords}
        setTeacherRecords={setTeacherRecords}
        expenses={expenses}
        setExpenses={setExpenses}
        bonusRules={bonusRules}
        setBonusRules={setBonusRules}
        markDirty={markDirty}
        notify={notify}
      />
    </div>
  )
}
