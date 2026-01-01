"use client"

import { useMemo } from "react"
import { useGlobalFinanceData } from "@/contexts/finance-data-context"
import { useNotification } from "@/hooks/use-notification"
import { TeachingStaffAnalytics } from "@/components/finance/teaching-staff-analytics"
import type { CoursePreset } from "@/types"

export default function TeachingStaffPage() {
  const { students, teachers, coursePresets, teacherRecords, setStudents, markDirty } = useGlobalFinanceData()
  const { notify } = useNotification()

  const flattenedPresets = useMemo<CoursePreset[]>(() => {
    console.log(`[v0] Processing coursePresets, is array:`, Array.isArray(coursePresets))

    if (!coursePresets) {
      console.log(`[v0] coursePresets is null/undefined`)
      return []
    }

    // If coursePresets is already an array of PresetCourse objects
    if (Array.isArray(coursePresets)) {
      console.log(`[v0] coursePresets is an array with ${coursePresets.length} items`)

      // Group courses by major/grade/semester
      const grouped = new Map<string, CoursePreset>()

      coursePresets.forEach((course: any) => {
        if (!course || typeof course !== "object") return

        const { major, grade, semester } = course
        if (!major || !grade || !semester) {
          console.log(`[v0] Skipping course with missing metadata:`, course)
          return
        }

        const key = `${major}|${grade}|${semester}`

        if (!grouped.has(key)) {
          grouped.set(key, {
            major,
            grade,
            semester,
            courses: [],
          })
        }

        grouped.get(key)!.courses.push(course)
      })

      const result = Array.from(grouped.values())
      console.log(`[v0] Grouped into ${result.length} course presets`)
      if (result.length > 0) {
        console.log(`[v0] Sample preset:`, {
          major: result[0].major,
          grade: result[0].grade,
          semester: result[0].semester,
          coursesCount: result[0].courses.length,
          firstCourse: result[0].courses[0],
        })
      }
      return result
    }

    // If coursePresets is a nested object structure (PresetData)
    const result: CoursePreset[] = []

    Object.entries(coursePresets).forEach(([major, gradeData]) => {
      if (!gradeData || typeof gradeData !== "object") return

      Object.entries(gradeData).forEach(([grade, semesterData]) => {
        if (!semesterData || typeof semesterData !== "object") return

        Object.entries(semesterData).forEach(([semester, courses]) => {
          if (Array.isArray(courses)) {
            result.push({ major, grade, semester, courses })
          }
        })
      })
    })

    console.log(`[v0] Processed nested structure into ${result.length} presets`)
    return result
  }, [coursePresets])

  const handleUpdateStudent = (updatedStudent: any) => {
    setStudents(students.map((s) => (s.id === updatedStudent.id ? updatedStudent : s)))
    markDirty()
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">老师课酬管理</h1>
        <p className="text-muted-foreground mt-2">查看各教师的授课情况、学生数量、成本与利润分析</p>
      </div>
      <TeachingStaffAnalytics
        students={students}
        teachers={teachers}
        coursePresets={flattenedPresets}
        teacherRecords={teacherRecords || []}
        onUpdateStudent={handleUpdateStudent}
        notify={notify}
        studentsCount={students.length}
        teachersCount={teachers.length}
      />
    </div>
  )
}
