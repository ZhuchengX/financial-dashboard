"use client"

import { ExpenseManager } from "@/components/finance/expense-manager"
import { useGlobalFinanceData } from "@/contexts/finance-data-context"
import { useNotification } from "@/hooks/use-notification"

export default function ExpensesPage() {
  const { students, expenses, setExpenses, markDirty } = useGlobalFinanceData()
  const { notify } = useNotification()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">运营杂费管理</h1>
        <p className="text-gray-500 mt-1">记录日常运营费用支出</p>
      </div>

      <ExpenseManager
        students={students}
        expenses={expenses}
        setExpenses={setExpenses}
        markDirty={markDirty}
        notify={notify}
      />
    </div>
  )
}
