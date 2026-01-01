"use client"

import { Dashboard } from "@/components/finance/dashboard"
import { DataImportExport } from "@/components/DataImportExport"
import { useGlobalFinanceData } from "@/contexts/finance-data-context"
import { useNotification } from "@/hooks/use-notification"

export default function FinancePage() {
  const { students, teacherRecords, expenses, initialBalance, setInitialBalance, markDirty } = useGlobalFinanceData()
  const { notify } = useNotification()

  return (
    <div className="space-y-6">
      <DataImportExport />
      <Dashboard
        students={students}
        teacherRecords={teacherRecords}
        expenses={expenses}
        initialBalance={initialBalance}
        setInitialBalance={(value) => {
          setInitialBalance(value)
          markDirty()
        }}
        notify={notify}
      />
    </div>
  )
}
