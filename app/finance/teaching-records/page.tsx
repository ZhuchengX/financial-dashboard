"use client"

import type React from "react"

import { useGlobalFinanceData } from "@/contexts/finance-data-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Trash2, Pencil, Check, X, Users } from "lucide-react"
import { useState, useMemo } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface EditForm {
  date: string
  teacherName: string
  courseName: string
  courseType: string
  projectTag: string
  attendedHours: string | number
  baseHourlyCost: string | number
  performanceCost: string | number
  status: string
  originalCourseName?: string
  originalCourseType?: string
  originalAttendedHours?: number
}

export default function TeachingRecordsPage() {
  const { teacherRecords, setTeacherRecords, students, setStudents, teachers, coursePresets, markDirty } =
    useGlobalFinanceData()
  const [resetStudentHours, setResetStudentHours] = useState(true)
  const [viewMode, setViewMode] = useState<"realtime" | "projected">("realtime")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({})

  const statusCycle = ["待支付待报销", "已支付待报销", "已支付已报销"]

  const handleStatusToggle = (e: React.MouseEvent, recordId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const updatedRecords = teacherRecords.map((record) => {
      if (record.id === recordId) {
        const currentIndex = statusCycle.indexOf(record.status || "待支付待报销")
        const nextIndex = (currentIndex + 1) % statusCycle.length
        return { ...record, status: statusCycle[nextIndex] }
      }
      return record
    })
    setTeacherRecords(updatedRecords)
    markDirty()
  }

  // Filter out bonus settlement records and sort by date
  const actualTeachingRecords = teacherRecords
    .filter((record) => !record.isBonusSettlement && record.attendedHours > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const deduplicatedRecords = useMemo(() => {
    const recordMap = new Map<string, (typeof actualTeachingRecords)[0]>()

    actualTeachingRecords.forEach((record) => {
      // 对于大班课，使用日期+老师+课程名+课程类型作为唯一key
      if (record.courseType === "大班课") {
        const key = `${record.date}-${record.teacherName}-${record.courseName}-${record.courseType}`
        if (!recordMap.has(key)) {
          recordMap.set(key, { ...record })
        }
        // 大班课不累加，只保留第一条记录（课时和成本都是一样的）
      } else {
        // 答疑课等其他类型保持原样，使用唯一ID
        recordMap.set(record.id, record)
      }
    })

    return Array.from(recordMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [actualTeachingRecords])

  const totalHours = deduplicatedRecords.reduce((sum, record) => sum + Number(record.attendedHours || 0), 0)
  const totalCost = deduplicatedRecords.reduce((sum, record) => sum + Number(record.totalCost || 0), 0)
  const uniqueTeachers = new Set(deduplicatedRecords.map((r) => r.teacherName)).size
  const uniqueCourses = new Set(deduplicatedRecords.map((r) => r.courseName)).size

  const calculateActualTeachingHours = () => {
    const courseMap = new Map<string, { hours: number; type: string }>()

    students.forEach((student) => {
      student.courses.forEach((course) => {
        if (course.attendedHours > 0) {
          const courseKey = `${course.name}-${course.type}-${course.teacherName || "未知"}`

          if (!courseMap.has(courseKey)) {
            courseMap.set(courseKey, { hours: 0, type: course.type || "大班课" })
          }

          const courseData = courseMap.get(courseKey)!
          if (course.type === "答疑课") {
            // 答疑课按学员累加
            courseData.hours += course.attendedHours
          } else {
            // 大班课取最大值（所有学员应该上同样的课时）
            courseData.hours = Math.max(courseData.hours, course.attendedHours)
          }
        }
      })
    })

    let totalHours = 0
    courseMap.forEach((data) => {
      totalHours += data.hours
    })
    return totalHours
  }

  const expectedTeachingHours = calculateActualTeachingHours()
  const totalRecordedHours = deduplicatedRecords.reduce((sum, record) => sum + record.attendedHours, 0)

  const hasDataInconsistency = Math.abs(expectedTeachingHours - totalRecordedHours) > 0.5

  const handleStartEdit = (record: any) => {
    setEditingId(record.id)
    setEditForm({
      date: record.date.split("T")[0], // 格式化为 yyyy-mm-dd
      teacherName: record.teacherName,
      courseName: record.courseName,
      courseType: record.courseType,
      projectTag: record.projectTag || "",
      attendedHours: record.attendedHours,
      baseHourlyCost: record.baseHourlyCost,
      performanceCost: record.performanceCost || 0,
      status: record.status,
      originalCourseName: record.courseName,
      originalCourseType: record.courseType,
      originalAttendedHours: record.attendedHours,
    })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const handleSaveEdit = () => {
    if (!editingId || !editForm) return

    const newAttendedHours = Number.parseFloat(String(editForm.attendedHours)) || 0
    const originalAttendedHours = editForm.originalAttendedHours || 0
    const hoursDifference = newAttendedHours - originalAttendedHours

    const editingRecord = teacherRecords.find((r) => r.id === editingId)
    if (!editingRecord) return

    const updatedRecords = teacherRecords.map((record) => {
      if (record.id === editingId) {
        const totalCost =
          Number.parseFloat(String(editForm.baseHourlyCost)) * newAttendedHours +
          Number.parseFloat(String(editForm.performanceCost || 0))
        return {
          ...record,
          date: new Date(editForm.date).toISOString(),
          teacherName: editForm.teacherName,
          courseName: editForm.courseName,
          courseType: editForm.courseType,
          projectTag: editForm.projectTag,
          attendedHours: newAttendedHours,
          baseHourlyCost: Number.parseFloat(String(editForm.baseHourlyCost)) || 0,
          performanceCost: Number.parseFloat(String(editForm.performanceCost)) || 0,
          totalCost: totalCost,
          status: editForm.status,
        }
      }
      if (
        editingRecord.courseType === "大班课" &&
        record.date === editingRecord.date &&
        record.teacherName === editingRecord.teacherName &&
        record.courseName === editingRecord.courseName &&
        record.courseType === editingRecord.courseType
      ) {
        const totalCost =
          Number.parseFloat(String(editForm.baseHourlyCost)) * newAttendedHours +
          Number.parseFloat(String(editForm.performanceCost || 0))
        return {
          ...record,
          date: new Date(editForm.date).toISOString(),
          teacherName: editForm.teacherName,
          courseName: editForm.courseName,
          courseType: editForm.courseType,
          attendedHours: newAttendedHours,
          baseHourlyCost: Number.parseFloat(String(editForm.baseHourlyCost)) || 0,
          performanceCost: Number.parseFloat(String(editForm.performanceCost)) || 0,
          totalCost: totalCost,
          status: editForm.status,
        }
      }
      return record
    })

    if (
      hoursDifference !== 0 ||
      editForm.courseName !== editForm.originalCourseName ||
      editForm.courseType !== editForm.originalCourseType
    ) {
      const updatedStudents = students.map((student) => {
        const courseIndex = student.courses.findIndex(
          (c) => c.name === editForm.originalCourseName && c.type === editForm.originalCourseType,
        )

        if (courseIndex === -1) return student

        const updatedCourses = [...student.courses]
        const currentHours = updatedCourses[courseIndex].attendedHours || 0

        if (
          editForm.courseName !== editForm.originalCourseName ||
          editForm.courseType !== editForm.originalCourseType
        ) {
          updatedCourses[courseIndex] = {
            ...updatedCourses[courseIndex],
            name: editForm.courseName,
            type: editForm.courseType as "大班课" | "答疑课",
            attendedHours: Math.max(0, currentHours + hoursDifference),
          }
        } else {
          updatedCourses[courseIndex] = {
            ...updatedCourses[courseIndex],
            attendedHours: Math.max(0, currentHours + hoursDifference),
          }
        }

        return {
          ...student,
          courses: updatedCourses,
        }
      })

      setStudents(updatedStudents)
    }

    setTeacherRecords(updatedRecords)
    markDirty()
    setEditingId(null)
    setEditForm({})
  }

  const handleDeleteRecord = (id: string) => {
    const recordToDelete = teacherRecords.find((record) => record.id === id)

    if (recordToDelete) {
      // Find all related records for group classes (same course, teacher, date)
      const relatedRecordIds = teacherRecords
        .filter(
          (r) =>
            r.courseName === recordToDelete.courseName &&
            r.courseType === recordToDelete.courseType &&
            r.teacherName === recordToDelete.teacherName &&
            r.date === recordToDelete.date,
        )
        .map((r) => r.id)

      const hoursToRestore = recordToDelete.attendedHours

      console.log("[v0] Deleting record:", {
        courseName: recordToDelete.courseName,
        courseType: recordToDelete.courseType,
        teacherName: recordToDelete.teacherName,
        hoursToRestore,
        relatedRecordIds: relatedRecordIds.length,
      })

      // Update students - match by course name and type only (not teacher)
      // because the student's course.teacherName might be the default teacher, not the actual teaching teacher
      const updatedStudents = students.map((student) => {
        const courseIndex = student.courses.findIndex(
          (course) => course.name === recordToDelete.courseName && course.type === recordToDelete.courseType,
        )

        if (courseIndex === -1) return student

        const course = student.courses[courseIndex]
        // Only restore if student has attended hours
        if (course.attendedHours <= 0) return student

        const newAttendedHours = Math.max(0, course.attendedHours - hoursToRestore)

        console.log("[v0] Restoring hours for student:", {
          studentName: student.name,
          courseName: course.name,
          oldHours: course.attendedHours,
          newHours: newAttendedHours,
        })

        const updatedCourses = [...student.courses]
        updatedCourses[courseIndex] = {
          ...course,
          attendedHours: newAttendedHours,
        }

        return {
          ...student,
          courses: updatedCourses,
        }
      })

      setStudents(updatedStudents)

      const updatedRecords = teacherRecords.filter((record) => !relatedRecordIds.includes(record.id))
      setTeacherRecords(updatedRecords)

      markDirty()

      console.log(
        "[v0] Delete completed, students updated:",
        updatedStudents
          .filter((s) => s.courses.some((c) => c.name === recordToDelete.courseName))
          .map((s) => ({ name: s.name, course: s.courses.find((c) => c.name === recordToDelete.courseName) })),
      )
    } else {
      const updatedRecords = teacherRecords.filter((record) => record.id !== id)
      setTeacherRecords(updatedRecords)
      markDirty()
    }
  }

  const handleClearRecords = () => {
    setTeacherRecords([])
    if (resetStudentHours) {
      const updatedStudents = students.map((student) => ({
        ...student,
        courses: student.courses.map((course) => ({
          ...course,
          attendedHours: 0,
        })),
      }))
      setStudents(updatedStudents)
    }
    markDirty()
  }

  const handleRebuildFromStudentData = () => {
    const courseMap = new Map<string, any>()

    students.forEach((student) => {
      student.courses.forEach((course) => {
        if (course.attendedHours > 0) {
          const courseKey = `${course.name}-${course.type}-${course.teacherName || "未知"}`

          if (!courseMap.has(courseKey)) {
            const teacher = teachers.find((t) => t.name === course.teacherName)
            const baseSalary = teacher?.customBaseSalary || teacher?.baseSalary || course.teacherBaseCost || 0
            const costPerHour = course.type === "答疑课" ? 500 : baseSalary

            courseMap.set(courseKey, {
              teacherName: course.teacherName || "未知",
              courseName: course.name,
              courseType: course.type || "大班课",
              semester: course.semester || "",
              costPerHour: costPerHour,
              totalHours: 0,
              students: new Set<string>(),
            })
          }

          const courseData = courseMap.get(courseKey)!
          if (course.type === "答疑课") {
            courseData.totalHours += course.attendedHours
          } else {
            courseData.totalHours = Math.max(courseData.totalHours, course.attendedHours)
          }
          courseData.students.add(student.name)
        }
      })
    })

    const newRecords: any[] = []
    courseMap.forEach((courseData, key) => {
      newRecords.push({
        id: `rebuild-${key}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        date: new Date().toISOString(),
        teacherName: courseData.teacherName,
        courseName: courseData.courseName,
        courseType: courseData.courseType,
        projectTag: `${courseData.students.size}人`,
        attendedHours: courseData.totalHours,
        baseHourlyCost: courseData.costPerHour,
        performanceCost: 0,
        totalCost: courseData.costPerHour * courseData.totalHours,
        status: "待支付",
        isBonusSettlement: false,
      })
    })

    setTeacherRecords(newRecords)
    markDirty()
  }

  const getStudentsForCourse = (courseName: string, teacherName: string, courseType: string) => {
    const studentList: { name: string; attendedHours: number }[] = []

    students.forEach((student) => {
      student.courses.forEach((course) => {
        if (
          course.name === courseName &&
          (course.teacherName === teacherName || !course.teacherName) &&
          course.attendedHours > 0
        ) {
          studentList.push({
            name: student.name,
            attendedHours: course.attendedHours,
          })
        }
      })
    })

    return studentList
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">授课记录</h1>
          <p className="text-muted-foreground">查看和编辑所有已授课的详细记录</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              清空所有授课记录
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认清空所有授课记录？</AlertDialogTitle>
              <AlertDialogDescription>
                <div className="space-y-4">
                  <div>此操作将永久删除所有授课记录（当前 {deduplicatedRecords.length} 条），此操作无法撤销。</div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="reset-hours"
                      checked={resetStudentHours}
                      onCheckedChange={(checked) => setResetStudentHours(checked as boolean)}
                    />
                    <Label htmlFor="reset-hours" className="text-sm font-normal">
                      同时重置所有学生的已消课时为 0
                    </Label>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleClearRecords} className="bg-destructive text-destructive-foreground">
                确认清空
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>总授课记录</CardDescription>
            <CardTitle className="text-3xl">{deduplicatedRecords.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>总授课课时</CardDescription>
            <CardTitle className="text-3xl">{totalHours.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>总课酬成本</CardDescription>
            <CardTitle className="text-3xl">¥{totalCost.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>授课记录明细</CardTitle>
          <CardDescription>点击编辑按钮可修改记录，修改后自动保存到全局数据</CardDescription>
        </CardHeader>
        <CardContent>
          {deduplicatedRecords.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">暂无授课记录</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>授课日期</TableHead>
                    <TableHead>授课老师</TableHead>
                    <TableHead>
                      课程名称
                      <span className="text-xs text-muted-foreground">(点击查看学生)</span>
                    </TableHead>
                    <TableHead>课程类型</TableHead>
                    <TableHead className="text-right">授课课时</TableHead>
                    <TableHead className="text-right">课时单价</TableHead>
                    <TableHead className="text-right">奖金课酬</TableHead>
                    <TableHead className="text-right">总成本</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deduplicatedRecords.map((record) => (
                    <TableRow key={record.id}>
                      {editingId === record.id ? (
                        <>
                          <TableCell>
                            <Input
                              type="date"
                              value={editForm.date}
                              onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                              className="w-32"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={editForm.teacherName}
                              onValueChange={(value) => setEditForm({ ...editForm, teacherName: value })}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {teachers.map((teacher) => (
                                  <SelectItem key={teacher.id} value={teacher.name}>
                                    {teacher.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={editForm.courseName}
                              onChange={(e) => setEditForm({ ...editForm, courseName: e.target.value })}
                              className="w-32"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={editForm.courseType}
                              onValueChange={(value) => setEditForm({ ...editForm, courseType: value })}
                            >
                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="大班课">大班课</SelectItem>
                                <SelectItem value="答疑课">答疑课</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={editForm.attendedHours}
                              onChange={(e) => setEditForm({ ...editForm, attendedHours: e.target.value })}
                              className="w-20 text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={editForm.baseHourlyCost}
                              onChange={(e) => setEditForm({ ...editForm, baseHourlyCost: e.target.value })}
                              className="w-20 text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={editForm.performanceCost}
                              onChange={(e) => setEditForm({ ...editForm, performanceCost: e.target.value })}
                              className="w-20 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            ¥
                            {(
                              (Number.parseFloat(editForm.baseHourlyCost) || 0) *
                                (Number.parseFloat(editForm.attendedHours) || 0) +
                              (Number.parseFloat(editForm.performanceCost) || 0)
                            ).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={editForm.status}
                              onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                            >
                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="待支付待报销">待支付待报销</SelectItem>
                                <SelectItem value="已支付待报销">已支付待报销</SelectItem>
                                <SelectItem value="已支付已报销">已支付已报销</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleSaveEdit}
                                className="h-8 w-8 p-0 text-green-600"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleCancelEdit}
                                className="h-8 w-8 p-0 text-gray-500"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0 text-blue-600">
                                  <Users className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80">
                                <div className="space-y-2">
                                  <h4 className="font-semibold">学生名单</h4>
                                  <ul className="list-disc list-inside">
                                    {getStudentsForCourse(
                                      editForm.courseName,
                                      editForm.teacherName,
                                      editForm.courseType,
                                    ).map((student) => (
                                      <li key={student.name}>
                                        {student.name} - {student.attendedHours.toFixed(2)} 课时
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="whitespace-nowrap">
                            {new Date(record.date).toLocaleDateString("zh-CN")}
                          </TableCell>
                          <TableCell className="font-medium">{record.teacherName}</TableCell>
                          <TableCell>
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="text-left hover:text-primary hover:underline cursor-pointer transition-colors">
                                  {record.courseName}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-0" align="start">
                                <div className="p-3 border-b bg-muted/50">
                                  <h4 className="font-semibold text-sm">{record.courseName}</h4>
                                  <p className="text-xs text-muted-foreground">授课老师: {record.teacherName}</p>
                                </div>
                                <div className="p-3">
                                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    授课学生名单
                                  </p>
                                  {(() => {
                                    const studentList = getStudentsForCourse(
                                      record.courseName,
                                      record.teacherName,
                                      record.courseType,
                                    )
                                    if (studentList.length === 0) {
                                      return <p className="text-sm text-muted-foreground">暂无学生记录</p>
                                    }
                                    return (
                                      <ul className="space-y-1.5">
                                        {studentList.map((s, idx) => (
                                          <li key={idx} className="flex items-center justify-between text-sm">
                                            <span>{s.name}</span>
                                            <span className="text-xs text-muted-foreground">{s.attendedHours}课时</span>
                                          </li>
                                        ))}
                                      </ul>
                                    )
                                  })()}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                record.courseType === "大班课"
                                  ? "border-blue-500 text-blue-600 bg-blue-50"
                                  : "border-orange-500 text-orange-600 bg-orange-50"
                              }
                            >
                              {record.courseType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {Number(record.attendedHours || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">¥{Number(record.baseHourlyCost || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            ¥{Number(record.performanceCost || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            ¥{Number(record.totalCost || 0).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors min-w-[100px] ${
                                record.status === "已支付已报销"
                                  ? "bg-muted text-muted-foreground hover:bg-muted/80"
                                  : record.status === "已支付待报销"
                                    ? "bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400"
                                    : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                              }`}
                              onClick={(e) => handleStatusToggle(e, record.id)}
                              title="点击切换状态"
                            >
                              {record.status || "待支付待报销"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleStartEdit(record)}
                                className="h-8 w-8 p-0 text-blue-600"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>确认删除？</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      确定要删除这条授课记录吗？此操作无法撤销。
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>取消</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteRecord(record.id)}
                                      className="bg-destructive text-destructive-foreground"
                                    >
                                      确认删除
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
