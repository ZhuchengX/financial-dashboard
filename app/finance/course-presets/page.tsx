"use client"

import { useGlobalFinanceData } from "@/contexts/finance-data-context"
import { useNotification } from "@/hooks/use-notification"
import { CoursePresetManagement } from "@/components/finance/course-preset-management"

export default function CoursePresetsPage() {
  const { presetData, setPresetData, teachers, setTeachers, markDirty } = useGlobalFinanceData()
  const { notify } = useNotification()

  const handleSetPresetData = (data: any) => {
    setPresetData(data)
    markDirty()
  }

  return (
    <div className="p-6">
      <CoursePresetManagement
        presetData={presetData}
        setPresetData={handleSetPresetData}
        teachers={teachers}
        setTeachers={setTeachers}
        markDirty={markDirty}
        notify={notify}
      />
    </div>
  )
}
