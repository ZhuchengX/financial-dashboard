"use client"

import { CourseBatchDeduction } from "@/components/finance/course-batch-deduction"
import { useGlobalFinanceData } from "@/contexts/finance-data-context"
import { useNotification } from "@/hooks/use-notification"

export default function CourseDeductionPage() {
  const { students, teacherRecords, teachers, coursePresets, setStudents, setTeacherRecords, markDirty } =
    useGlobalFinanceData()
  const { notify } = useNotification()

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">课程消课管理</h1>
      <CourseBatchDeduction
        students={students}
        teacherRecords={teacherRecords}
        teachers={teachers}
        coursePresets={coursePresets}
        setStudents={setStudents}
        setTeacherRecords={setTeacherRecords}
        markDirty={markDirty}
        notify={notify}
      />
    </div>
  )
}
