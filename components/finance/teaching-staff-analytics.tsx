"use client"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useMemo, useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BookOpen, DollarSign } from "lucide-react"
import type { Student, Teacher, CoursePreset } from "@/types"
import { TEACHER_TIERS } from "@/lib/constants"

type TeacherStats = {
  teacherName: string
  tier: string
  baseSalary: number
  totalHours: number
  totalCost: number
  studentCount: number
  courseCount: number
  courses: {
    courseKey: string
    courseName: string
    courseType: string
    major: string
    grade: string
    consumedHours: number
    projectedHours: number
    consumedCost: number
    projectedCost: number
    studentCount: number
    consumedRevenue: number
    projectedRevenue: number
    consumedProfit: number
    projectedProfit: number
  }[]
}

type TeacherStat = {
  teacherName: string
  tier: string
  baseSalary: number
  totalHours: number
  totalCost: number
  studentIds: Set<string>
  studentCount: number
  courseCount: number
  courses: Array<{
    courseKey: string
    courseName: string
    courseType: string
    major: string
    grade: string
    studentCount: number
    students: Array<{ id: string; name: string; major: string; grade: string }>
    consumedHours: number
    projectedHours: number
    consumedCost: number
    projectedCost: number
    consumedRevenue: number
    projectedRevenue: number
    consumedProfit: number
    projectedProfit: number
  }>
}

type TeachingStaffAnalyticsProps = {
  students: Student[]
  teachers: Teacher[]
  coursePresets: CoursePreset[]
  teacherRecords: any[] // Assuming teacherRecords is an array of objects with teacherName, courseName, courseType, and hours
  onUpdateStudent: (student: Student) => void
  notify: (message: string, type: "success" | "error" | "info") => void
  studentsCount: number
  teachersCount: number
}

export function TeachingStaffAnalytics({
  students,
  teachers,
  coursePresets,
  teacherRecords,
  onUpdateStudent,
  notify,
  studentsCount,
  teachersCount,
}: TeachingStaffAnalyticsProps) {
  console.log("[v0] TeachingStaffAnalytics - Data received:", {
    students: students.length,
    teachers: teachers.length,
    presets: coursePresets.length,
  })

  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null)
  const [selectedTeacher, setSelectedTeacher] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"name" | "hours" | "profit" | "students">("name")
  const [viewMode, setViewMode] = useState<"projected" | "realtime">("projected")
  const [selectedCourseStudents, setSelectedCourseStudents] = useState<{
    courseName: string
    courseType: string
    students: Array<{ id: string; name: string; major: string; grade: string }>
  } | null>(null)

  useEffect(() => {
    console.log("[v0] TeachingStaffAnalytics received props:", {
      studentsCount,
      teachersCount,
    })
  }, [studentsCount, teachersCount])

  const teacherStats = useMemo(() => {
    console.log("[v0] Calculating teacher stats...")
    console.log("[v0] Input data:", {
      studentsCount: students.length,
      teachersCount: teachers.length,
      coursePresetsCount: coursePresets.length,
    })

    const statsMap = new Map<
      string,
      {
        teacherName: string
        tier: string
        baseSalary: number
        totalHours: number
        totalCost: number
        studentIds: Set<string>
        studentCount: number
        courseCount: number
        courses: Array<{
          courseKey: string
          courseName: string
          courseType: string
          major: string
          grade: string
          studentCount: number
          students: Array<{ id: string; name: string; major: string; grade: string }>
          consumedHours: number
          projectedHours: number
          consumedCost: number
          projectedCost: number
          consumedRevenue: number
          projectedRevenue: number
          consumedProfit: number
          projectedProfit: number
        }>
      }
    >()

    const courseTypeCount = { 大班课: 0, 答疑课: 0 }

    teachers.forEach((teacher) => {
      const baseSalary = teacher.customBaseSalary || TEACHER_TIERS[teacher.tierIndex]?.base || 0
      statsMap.set(teacher.name, {
        teacherName: teacher.name,
        tier: teacher.tierIndex < TEACHER_TIERS.length ? TEACHER_TIERS[teacher.tierIndex].name : "未定级",
        baseSalary: baseSalary,
        totalHours: 0,
        totalCost: 0,
        studentIds: new Set<string>(),
        studentCount: 0,
        courseCount: 0,
        courses: [],
      })
    })

    console.log("[v0] Processing course presets...")
    let processedPresets = 0
    let skippedNotGroupClass = 0
    let skippedNoTeacher = 0
    let invalidPresets = 0

    coursePresets.forEach((preset, index) => {
      if (!preset || typeof preset !== "object") {
        console.log("[v0] Invalid preset at index:", index, preset)
        invalidPresets++
        return
      }

      if (!Array.isArray(preset.courses)) {
        console.log("[v0] preset.courses is not an array:", {
          index,
          major: preset.major,
          grade: preset.grade,
          semester: preset.semester,
          coursesType: typeof preset.courses,
          courses: preset.courses,
        })
        invalidPresets++
        return
      }

      preset.courses.forEach((course) => {
        // Only process group classes (大班课)
        if (course.type !== "大班课") {
          skippedNotGroupClass++
          return
        }

        const teacherName = course.defaultTeacher
        if (!teacherName) {
          skippedNoTeacher++
          return
        }

        processedPresets++

        // Find or create teacher stat entry
        if (!statsMap.has(teacherName)) {
          // Auto-add teacher if not exists
          statsMap.set(teacherName, {
            teacherName,
            tier: "待定",
            baseSalary: course.defaultCost || 0,
            totalHours: 0,
            totalCost: 0,
            studentIds: new Set<string>(),
            studentCount: 0,
            courseCount: 0,
            courses: [],
          })
        }

        const teacherStat = statsMap.get(teacherName)!
        const courseKey = `${preset.grade}-${course.name}-${course.type}`

        // Check if this course already exists
        let courseDetail = teacherStat.courses.find((c) => c.courseKey === courseKey)

        if (!courseDetail) {
          courseDetail = {
            courseKey,
            courseName: course.name,
            courseType: course.type,
            major: preset.major,
            grade: preset.grade,
            studentCount: 0,
            students: [],
            consumedHours: 0,
            projectedHours: course.hours || 0,
            consumedCost: 0,
            projectedCost: (course.hours || 0) * (course.defaultCost || 0),
            consumedRevenue: 0,
            projectedRevenue: 0,
            consumedProfit: 0, // Changed from negative to 0 - no actual teaching yet
            projectedProfit: 0 - (course.hours || 0) * (course.defaultCost || 0), // Keep projected as negative
          }
          teacherStat.courses.push(courseDetail)
          teacherStat.courseCount++
          courseTypeCount["大班课"]++
        }
      })
    })

    console.log("[v0] Preset processing summary:", {
      total: coursePresets.length,
      processed: processedPresets,
      skippedNotGroupClass,
      skippedNoTeacher,
      invalidPresets,
    })

    // Then, aggregate data from actual students
    students.forEach((student) => {
      student.courses.forEach((course) => {
        const courseName = course.name
        const totalHours = course.totalHours || 0
        const attendedHours = course.attendedHours || 0
        const price = course.hourlyRate || 0
        const teacherName = course.teacherName || course.teacher || ""
        const courseType = course.type || (course.isQACourse ? "答疑课" : "大班课")

        if (courseType === "答疑课") {
          courseTypeCount["答疑课"]++
        }

        if (!teacherName) return

        if (!statsMap.has(teacherName)) {
          const matchingPreset = coursePresets.find(
            (preset) => preset.major === student.major && preset.grade === student.grade,
          )
          const coursePresetData = matchingPreset?.courses.find((c) => c.name === courseName && c.type === courseType)

          statsMap.set(teacherName, {
            teacherName,
            tier: "待定",
            baseSalary: coursePresetData?.defaultCost || course.teacherBaseCost || 0,
            totalHours: 0,
            totalCost: 0,
            studentIds: new Set<string>(),
            studentCount: 0,
            courseCount: 0,
            courses: [],
          })
        }

        const teacherStat = statsMap.get(teacherName)!

        teacherStat.studentIds.add(student.id)

        const courseKey = `${student.grade}-${courseName}-${courseType}`
        let courseDetail = teacherStat.courses.find((c) => c.courseKey === courseKey)

        if (!courseDetail) {
          courseDetail = {
            courseKey,
            courseName,
            courseType,
            major: student.major,
            grade: student.grade,
            studentCount: 0,
            students: [],
            consumedHours: 0,
            projectedHours: 0,
            consumedCost: 0,
            projectedCost: 0,
            consumedRevenue: 0,
            projectedRevenue: 0,
            consumedProfit: 0,
            projectedProfit: 0,
          }
          teacherStat.courses.push(courseDetail)
          teacherStat.courseCount++
        }

        if (!courseDetail.students) {
          courseDetail.students = []
        }

        const studentExists = courseDetail.students.some((s) => s.id === student.id)
        if (!studentExists) {
          courseDetail.students.push({
            id: student.id,
            name: student.name,
            major: student.major,
            grade: student.grade,
          })
          courseDetail.studentCount++
        }

        const costPerHour = courseType === "答疑课" ? 500 : teacherStat.baseSalary

        if (courseType === "大班课") {
          if (courseDetail.studentCount === 1) {
            courseDetail.projectedHours = totalHours
            courseDetail.projectedCost = totalHours * costPerHour
            courseDetail.consumedHours = attendedHours
            courseDetail.consumedCost = attendedHours * costPerHour
          } else if (courseDetail.studentCount > 1) {
            // Update consumed hours to max of all students
            courseDetail.consumedHours = Math.max(courseDetail.consumedHours, attendedHours)
            courseDetail.consumedCost = courseDetail.consumedHours * costPerHour
          }
          courseDetail.projectedRevenue += totalHours * price
          courseDetail.consumedRevenue += attendedHours * price
        } else {
          courseDetail.projectedHours += totalHours
          courseDetail.projectedCost += totalHours * costPerHour
          courseDetail.projectedRevenue += totalHours * price

          courseDetail.consumedHours += attendedHours
          courseDetail.consumedCost += attendedHours * costPerHour
          courseDetail.consumedRevenue += attendedHours * price
        }

        courseDetail.projectedProfit = courseDetail.projectedRevenue - courseDetail.projectedCost
        courseDetail.consumedProfit = courseDetail.consumedRevenue - courseDetail.consumedCost
      })
    })

    // Process courses without students
    coursePresets.forEach((preset) => {
      if (!preset || !Array.isArray(preset.courses)) return

      preset.courses.forEach((course) => {
        const teacherName = course.defaultTeacher
        if (!teacherName) return

        const teacherStat = statsMap.get(teacherName)
        if (!teacherStat) return

        const courseKey = `${preset.grade}-${course.name}-${course.type}`

        const courseDetail = teacherStat.courses.find((c) => c.courseKey === courseKey)
        if (!courseDetail) {
          const hasTaughtRecord = teacherRecords.some(
            (record) =>
              record.teacherName === course.defaultTeacher &&
              record.courseName === course.name &&
              record.courseType === course.type,
          )

          teacherStat.courses.push({
            courseKey,
            courseName: course.name,
            courseType: course.type,
            major: preset.major || "",
            grade: preset.grade || "",
            studentCount: 0,
            students: [],
            consumedHours: 0,
            projectedHours: hasTaughtRecord ? course.hours || 0 : 0,
            consumedCost: 0,
            projectedCost: hasTaughtRecord ? (course.hours || 0) * (course.defaultCost || 0) : 0,
            consumedRevenue: 0,
            projectedRevenue: 0,
            consumedProfit: 0,
            projectedProfit: hasTaughtRecord ? 0 - (course.hours || 0) * (course.defaultCost || 0) : 0,
          })

          console.log(`[v0] 0-student course added: ${course.name}, hasTaughtRecord: ${hasTaughtRecord}`)
        }
      })
    })

    statsMap.forEach((stat) => {
      stat.studentCount = stat.studentIds.size

      stat.totalHours = stat.courses.reduce((sum, course) => {
        if (course.courseType === "大班课") {
          // For group classes, count hours only once regardless of student count
          return sum + (viewMode === "realtime" ? course.consumedHours : course.projectedHours)
        } else {
          // For tutoring, count hours for each student
          return sum + (viewMode === "realtime" ? course.consumedHours : course.projectedHours)
        }
      }, 0)

      stat.totalCost = stat.courses.reduce((sum, course) => {
        if (course.courseType === "大班课") {
          // For group classes, cost is counted once regardless of student count
          return sum + (viewMode === "realtime" ? course.consumedCost : course.projectedCost)
        } else {
          // For tutoring, cost is per student
          return sum + (viewMode === "realtime" ? course.consumedCost : course.projectedCost)
        }
      }, 0)
    })

    const result = Array.from(statsMap.values())

    console.log("[v0] Course type distribution:", courseTypeCount)
    console.log("[v0] Final teacher stats count:", result.length)
    console.log("[v0] Sample stat:", result[0])

    return result
  }, [students, teachers, coursePresets, teacherRecords, viewMode]) // 添加 viewMode 到依赖项

  const filteredAndSortedStats = useMemo(() => {
    let filtered = teacherStats

    if (selectedTeacher && selectedTeacher !== "all") {
      filtered = filtered.filter((stats) => stats.teacherName === selectedTeacher)
    }

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.teacherName.localeCompare(b.teacherName, "zh-CN")
        case "hours":
          return b.totalHours - a.totalHours
        case "profit":
          const aProfit = a.courses.reduce(
            (sum, c) => sum + (viewMode === "realtime" ? c.consumedProfit : c.projectedProfit),
            0,
          )
          const bProfit = b.courses.reduce(
            (sum, c) => sum + (viewMode === "realtime" ? c.consumedProfit : c.projectedProfit),
            0,
          )
          return bProfit - aProfit
        case "students":
          return b.studentCount - a.studentCount
        default:
          return 0
      }
    })
  }, [teacherStats, selectedTeacher, sortBy, viewMode])

  const overallStats = useMemo(() => {
    const uniqueStudentIds = new Set<string>()
    filteredAndSortedStats.forEach((stats) => {
      students.forEach((student) => {
        student.courses.forEach((course) => {
          const teacherName = course.teacherName || course.teacher || ""
          if (teacherName === stats.teacherName) {
            uniqueStudentIds.add(student.id)
          }
        })
      })
    })

    const total = filteredAndSortedStats.reduce(
      (acc, stats) => ({
        hours: acc.hours + stats.totalHours,
        cost: acc.cost + stats.totalCost,
        revenue:
          acc.revenue +
          stats.courses.reduce((sum, c) => sum + (viewMode === "realtime" ? c.consumedRevenue : c.projectedRevenue), 0),
      }),
      { hours: 0, cost: 0, revenue: 0 },
    )
    return {
      ...total,
      profit: total.revenue - total.cost,
      students: uniqueStudentIds.size,
    }
  }, [filteredAndSortedStats, viewMode, students])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">授课总时长</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.hours.toFixed(1)}课时</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">总成本</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">¥{overallStats.cost.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl">服务学生</CardTitle>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{overallStats.students}人</div>
                <div className="text-sm text-muted-foreground">服务学生</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.students}人</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl">创造价值</CardTitle>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">¥{overallStats.profit.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">利润贡献</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">¥{overallStats.profit.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="选择教师" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部教师</SelectItem>
            {teachers
              .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
              .map((teacher) => (
                <SelectItem key={teacher.id} value={teacher.name}>
                  {teacher.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="realtime">实时</SelectItem>
            <SelectItem value="projected">预计总和</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">按姓名排序</SelectItem>
            <SelectItem value="hours">按课时排序</SelectItem>
            <SelectItem value="profit">按利润排序</SelectItem>
            <SelectItem value="students">按学生数排序</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {filteredAndSortedStats.map((stats) => {
          const totalRevenue = stats.courses.reduce(
            (sum, c) => sum + (viewMode === "realtime" ? c.consumedRevenue : c.projectedRevenue),
            0,
          )
          const totalProfit = stats.courses.reduce(
            (sum, c) => sum + (viewMode === "realtime" ? c.consumedProfit : c.projectedProfit),
            0,
          )
          const teacher = teachers.find((t) => t.name === stats.teacherName)

          return (
            <Card key={stats.teacherName}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{stats.teacherName}</CardTitle>
                    {teacher && (
                      <div className="flex gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline">{teacher.gradSchool}</Badge>
                        <Badge variant="outline">
                          {teacher.rankPos}/{teacher.rankTotal}
                        </Badge>
                        <Badge variant="secondary">{TEACHER_TIERS[teacher.tierIndex]?.label || "未定级"}</Badge>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">¥{totalProfit.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">利润贡献</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {teacher && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <div className="text-sm text-muted-foreground">基础课酬</div>
                      <div className="flex gap-2 items-center mt-1">
                        <div className="font-medium">
                          {teacher.customBaseSalary || TEACHER_TIERS[teacher.tierIndex]?.base || 0}元/课时
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">授课总时长</div>
                      <div className="font-medium mt-1">
                        {stats.totalHours.toFixed(1)}
                        课时
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">总成本</div>
                      <div className="font-medium mt-1">¥{stats.totalCost.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">服务学生</div>
                      <div className="font-medium mt-1">{stats.studentCount}人</div>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="font-semibold mb-2">课程明细 ({stats.courses.length}门)</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>课程名称</TableHead>
                        <TableHead>课程类型</TableHead>
                        <TableHead className="text-right">课时</TableHead>
                        <TableHead className="text-right">学生数</TableHead>
                        <TableHead className="text-right">成本（元）</TableHead>
                        <TableHead className="text-right">收入（元）</TableHead>
                        <TableHead className="text-right">利润（元）</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.courses
                        .sort((a, b) => {
                          if (a.courseType !== b.courseType) {
                            return a.courseType === "大班课" ? -1 : 1
                          }
                          return a.courseName.localeCompare(b.courseName, "zh-CN")
                        })
                        .map((course) => {
                          const hours = viewMode === "realtime" ? course.consumedHours : course.projectedHours
                          const studentCount = course.studentCount
                          const cost = viewMode === "realtime" ? course.consumedCost : course.projectedCost
                          const revenue = viewMode === "realtime" ? course.consumedRevenue : course.projectedRevenue
                          const profit = viewMode === "realtime" ? course.consumedProfit : course.projectedProfit

                          return (
                            <TableRow key={course.courseKey}>
                              <TableCell className="font-medium">{course.courseName}</TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    course.courseType === "大班课"
                                      ? "border-blue-500 text-blue-700 bg-blue-50"
                                      : "border-orange-500 text-orange-700 bg-orange-50"
                                  }
                                >
                                  {course.courseType}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">{hours.toFixed(2)}</TableCell>
                              <TableCell className="text-right">
                                {studentCount === 0 ? (
                                  <span className="text-muted-foreground">0人</span>
                                ) : (
                                  <button
                                    className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                    onClick={() =>
                                      setSelectedCourseStudents({
                                        courseName: course.courseName,
                                        courseType: course.courseType,
                                        students: course.students,
                                      })
                                    }
                                  >
                                    {studentCount}人
                                  </button>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-amber-600">{cost.toFixed(2)}</TableCell>
                              <TableCell className="text-right text-blue-600">{revenue.toFixed(2)}</TableCell>
                              <TableCell
                                className={
                                  profit >= 0
                                    ? "text-right text-green-600 font-medium"
                                    : "text-right text-red-600 font-medium"
                                }
                              >
                                {profit.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell colSpan={2}>小计</TableCell>
                        <TableCell className="text-right">
                          {stats.totalHours.toFixed(2)}
                          课时
                        </TableCell>
                        <TableCell className="text-right">{stats.studentCount}人</TableCell>
                        <TableCell className="text-right">¥{stats.totalCost.toFixed(2)}</TableCell>
                        <TableCell className="text-right">¥{totalRevenue.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <span className={totalProfit >= 0 ? "text-green-600" : "text-red-600"}>
                            ¥{totalProfit.toFixed(2)}
                          </span>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredAndSortedStats.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {selectedTeacher && selectedTeacher !== "all" ? "该教师暂无授课记录" : "暂无授课记录"}
        </div>
      )}

      <Dialog open={!!selectedCourseStudents} onOpenChange={() => setSelectedCourseStudents(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedCourseStudents?.courseName} ({selectedCourseStudents?.courseType}) - 学生名单
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>专业</TableHead>
                  <TableHead>年级</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedCourseStudents?.students.map((student, index) => (
                  <TableRow key={`${student.id}-${index}`}>
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell>{student.major}</TableCell>
                    <TableCell>{student.grade}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="text-sm text-muted-foreground mt-2">共 {selectedCourseStudents?.students.length} 名学生</div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
