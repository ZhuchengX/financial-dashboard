"use client"

import { StudentEntryForm } from "@/components/finance/student-entry-form"
import { StudentFinancialSummary } from "@/components/finance/student-financial-summary"
import { useGlobalFinanceData } from "@/contexts/finance-data-context"
import { useNotification } from "@/hooks/use-notification"

export default function StudentsPage() {
  const { students, setStudents, expenses, setExpenses, presetData, setPresetData, teachers, markDirty } =
    useGlobalFinanceData()
  const { notify } = useNotification()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">学员信息录入</h1>
        <p className="text-gray-500 mt-1">录入学员基本信息、课程签约、佣金设置</p>
      </div>

      <StudentFinancialSummary students={students} setStudents={setStudents} markDirty={markDirty} />

      <StudentEntryForm
        students={students}
        setStudents={setStudents}
        expenses={expenses}
        setExpenses={setExpenses}
        presetData={presetData}
        setPresetData={setPresetData}
        teachers={teachers}
        markDirty={markDirty}
        notify={notify}
      />
    </div>
  )
}
