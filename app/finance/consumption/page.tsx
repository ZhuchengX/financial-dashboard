"use client"

import { StudentLog } from "@/components/finance/student-log"
import { TeacherCourseLog } from "@/components/finance/teacher-course-log"
import { useGlobalFinanceData } from "@/contexts/finance-data-context"
import { useNotification } from "@/hooks/use-notification"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function ConsumptionPage() {
  const { students, setStudents, teacherRecords, setTeacherRecords, teachers, markDirty } = useGlobalFinanceData()
  const { notify } = useNotification()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">学员消课管理</h1>
        <p className="text-gray-500 mt-1">课程消课记录、进度跟踪、老师授课情况</p>
      </div>

      <Tabs defaultValue="students" className="w-full">
        <TabsList>
          <TabsTrigger value="students">学员课程进度</TabsTrigger>
          <TabsTrigger value="teachers">老师授课情况</TabsTrigger>
        </TabsList>

        <TabsContent value="students">
          <StudentLog
            students={students}
            setStudents={setStudents}
            teacherRecords={teacherRecords}
            setTeacherRecords={setTeacherRecords}
            teachers={teachers}
            markDirty={markDirty}
            notify={notify}
          />
        </TabsContent>

        <TabsContent value="teachers">
          <TeacherCourseLog
            students={students}
            teachers={teachers}
            teacherRecords={teacherRecords}
            setTeacherRecords={setTeacherRecords}
            markDirty={markDirty}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
