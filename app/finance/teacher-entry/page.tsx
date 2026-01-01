"use client"

import { TeacherEntry } from "@/components/finance/teacher-entry"
import { useGlobalFinanceData } from "@/contexts/finance-data-context"
import { useNotification } from "@/hooks/use-notification"

export default function TeacherEntryPage() {
  const { teachers, setTeachers, markDirty } = useGlobalFinanceData()
  const { notify } = useNotification()

  return (
    <div className="p-6">
      <TeacherEntry teachers={teachers} setTeachers={setTeachers} markDirty={markDirty} notify={notify} />
    </div>
  )
}
