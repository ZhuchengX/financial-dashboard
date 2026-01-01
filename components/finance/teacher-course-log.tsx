"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar, Plus } from "lucide-react"
import type { Student, Teacher, TeacherRecord } from "@/types"
import { generateId } from "@/lib/id"

interface TeacherCourseLogProps {
  students: Student[]
  teachers: Teacher[]
  teacherRecords: TeacherRecord[]
  setTeacherRecords: (records: TeacherRecord[]) => void
  markDirty: () => void
}

export function TeacherCourseLog({
  students,
  teachers,
  teacherRecords,
  setTeacherRecords,
  markDirty,
}: TeacherCourseLogProps) {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("")
  const [viewMode, setViewMode] = useState<"overview" | "monthly" | "all">("overview")
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date())
  const [isAddRecordOpen, setIsAddRecordOpen] = useState(false)
  const [newRecord, setNewRecord] = useState({
    date: new Date().toISOString().split("T")[0],
    courseName: "",
    courseType: "大班课" as "大班课" | "答疑课",
    hours: "1",
    costPerHour: "1200",
  })

  const handleCleanupRecords = () => {
    console.log("[v0] Starting cleanup, total records:", teacherRecords.length)

    const negativeRecords = teacherRecords.filter((record) => {
      const hours = Number(record.attendedHours)
      return hours < 0
    })

    console.log("[v0] Found negative records:", negativeRecords.length)

    const recordsToRemove = new Set<string>()

    negativeRecords.forEach((negRecord) => {
      recordsToRemove.add(negRecord.id || "")

      const matchingPositive = teacherRecords.find((record) => {
        if (recordsToRemove.has(record.id || "")) return false
        if (record.teacherName !== negRecord.teacherName) return false
        if (record.courseName !== negRecord.courseName) return false
        if (record.courseType !== negRecord.courseType) return false
        if (record.date !== negRecord.date) return false

        const hours = Number(record.attendedHours)
        const negHours = Number(negRecord.attendedHours)
        return hours > 0 && Math.abs(hours + negHours) < 0.01
      })

      if (matchingPositive) {
        recordsToRemove.add(matchingPositive.id || "")
        console.log("[v0] Found paired records to remove:", {
          positive: matchingPositive.courseName,
          hours: matchingPositive.attendedHours,
          negative: negRecord.courseName,
          negHours: negRecord.attendedHours,
        })
      }
    })

    teacherRecords.forEach((record) => {
      const hours = Number(record.attendedHours)
      if (hours === 0) {
        recordsToRemove.add(record.id || "")
      }
    })

    const validRecords = teacherRecords.filter((record) => !recordsToRemove.has(record.id || ""))

    const removedCount = teacherRecords.length - validRecords.length

    console.log("[v0] Cleanup complete, removed:", removedCount, "remaining:", validRecords.length)

    if (removedCount > 0) {
      setTeacherRecords(validRecords)
      markDirty()
      alert(`已清理 ${removedCount} 条无效记录（包括互相抵消的配对记录）`)
    } else {
      alert("没有发现需要清理的无效记录")
    }
  }

  const handleDeleteRecord = (recordId: string) => {
    if (!confirm("确定要删除这条授课记录吗？")) return

    const updatedRecords = teacherRecords.filter((record) => record.id !== recordId)
    setTeacherRecords(updatedRecords)
    markDirty()
    console.log("[v0] Deleted record, remaining:", updatedRecords.length)
  }

  const selectedTeacher = useMemo(() => {
    return teachers.find((t) => t.id === selectedTeacherId)
  }, [selectedTeacherId, teachers])

  const teacherCourseStats = useMemo(() => {
    if (!selectedTeacherId || selectedTeacherId === "all") return []

    const courseMap = new Map<
      string,
      {
        courseName: string
        courseType: string
        totalHours: number
        consumedHours: number
        remainingHours: number
        studentCount: number
        students: string[]
      }
    >()

    students.forEach((student) => {
      student.courses.forEach((course) => {
        const courseTeacher = course.teacherName || course.assignedTeacher || ""
        if (courseTeacher === selectedTeacher?.name) {
          const key = `${course.name}-${course.type}`

          if (!courseMap.has(key)) {
            courseMap.set(key, {
              courseName: course.name,
              courseType: course.type,
              totalHours: 0,
              consumedHours: 0,
              remainingHours: 0,
              studentCount: 0,
              students: [],
            })
          }

          const stats = courseMap.get(key)!
          stats.totalHours += course.totalHours || 0
          stats.studentCount += 1
          stats.students.push(student.name)
        }
      })
    })

    teacherRecords.forEach((record) => {
      if (record.teacherName === selectedTeacher?.name) {
        const key = `${record.courseName}-${record.courseType}`
        const stats = courseMap.get(key)
        if (stats) {
          stats.consumedHours += record.attendedHours || 0
        }
      }
    })

    courseMap.forEach((stats) => {
      stats.remainingHours = stats.totalHours - stats.consumedHours
    })

    return Array.from(courseMap.values())
  }, [selectedTeacherId, students, teachers, teacherRecords, selectedTeacher])

  const totalStats = useMemo(() => {
    return teacherCourseStats.reduce(
      (acc, course) => ({
        totalHours: acc.totalHours + course.totalHours,
        consumedHours: acc.consumedHours + course.consumedHours,
        remainingHours: acc.remainingHours + course.remainingHours,
        studentCount: acc.studentCount + course.studentCount,
      }),
      { totalHours: 0, consumedHours: 0, remainingHours: 0, studentCount: 0 },
    )
  }, [teacherCourseStats])

  const monthlyStats = useMemo(() => {
    if (!selectedTeacherId || viewMode !== "monthly") return null

    const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId)
    if (!selectedTeacher) return null

    const year = selectedMonth.getFullYear()
    const month = selectedMonth.getMonth()
    const startDate = new Date(year, month, 1)
    const endDate = new Date(year, month + 1, 0, 23, 59, 59)

    const monthRecords = teacherRecords.filter((record) => {
      if (record.teacherName !== selectedTeacher.name) return false
      const hours = Number(record.attendedHours)
      if (hours <= 0) return false

      const recordDate = new Date(record.date)
      return recordDate >= startDate && recordDate <= endDate
    })

    const courseMap = new Map<
      string,
      {
        courseName: string
        courseType: string
        totalHours: number
        totalCost: number
        records: TeacherRecord[]
      }
    >()

    monthRecords.forEach((record) => {
      const key = `${record.courseName}-${record.courseType}`

      if (!courseMap.has(key)) {
        courseMap.set(key, {
          courseName: record.courseName,
          courseType: record.courseType,
          totalHours: 0,
          totalCost: 0,
          records: [],
        })
      }

      const stats = courseMap.get(key)!
      stats.totalHours += record.attendedHours || 0
      stats.totalCost += record.totalCost || 0
      stats.records.push(record)
    })

    const courses = Array.from(courseMap.values())

    return {
      year,
      month: month + 1,
      totalHours: courses.reduce((sum, c) => sum + c.totalHours, 0),
      totalCost: courses.reduce((sum, c) => sum + c.totalCost, 0),
      courses,
    }
  }, [selectedTeacherId, viewMode, selectedMonth, teachers, teacherRecords])

  const allTeachersMonthlyStats = useMemo(() => {
    if (viewMode !== "all") return null

    const year = selectedMonth.getFullYear()
    const month = selectedMonth.getMonth()
    const startDate = new Date(year, month, 1)
    const endDate = new Date(year, month + 1, 0, 23, 59, 59)

    const teacherStatsMap = new Map<
      string,
      {
        teacherName: string
        totalHours: number
        totalCost: number
        courseCount: number
        courses: Array<{
          courseName: string
          courseType: string
          hours: number
          cost: number
        }>
      }
    >()

    teacherRecords.forEach((record) => {
      const hours = Number(record.attendedHours)
      if (hours <= 0) return

      const recordDate = new Date(record.date)
      if (recordDate < startDate || recordDate > endDate) return

      if (!teacherStatsMap.has(record.teacherName)) {
        teacherStatsMap.set(record.teacherName, {
          teacherName: record.teacherName,
          totalHours: 0,
          totalCost: 0,
          courseCount: 0,
          courses: [],
        })
      }

      const stats = teacherStatsMap.get(record.teacherName)!
      stats.totalHours += hours
      stats.totalCost += record.totalCost || 0

      const courseKey = `${record.courseName}-${record.courseType}`
      const existingCourse = stats.courses.find((c) => `${c.courseName}-${c.courseType}` === courseKey)

      if (existingCourse) {
        existingCourse.hours += hours
        existingCourse.cost += record.totalCost || 0
      } else {
        stats.courses.push({
          courseName: record.courseName,
          courseType: record.courseType,
          hours: hours,
          cost: record.totalCost || 0,
        })
        stats.courseCount += 1
      }
    })

    const teachersList = Array.from(teacherStatsMap.values()).sort((a, b) => b.totalCost - a.totalCost)

    const totalAllCost = teachersList.reduce((sum, t) => sum + t.totalCost, 0)
    const totalAllHours = teachersList.reduce((sum, t) => sum + t.totalHours, 0)

    return {
      year,
      month: month + 1,
      teachers: teachersList,
      totalAllCost,
      totalAllHours,
      teacherCount: teachersList.length,
    }
  }, [viewMode, selectedMonth, teacherRecords])

  const handleAddRecord = () => {
    if (!selectedTeacherId || !newRecord.courseName || !newRecord.hours || !newRecord.costPerHour) {
      alert("请填写完整的授课记录信息")
      return
    }

    const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId)
    if (!selectedTeacher) return

    const hours = Number.parseFloat(newRecord.hours)
    const costPerHour = Number.parseFloat(newRecord.costPerHour)

    const record = {
      id: `record-${Date.now()}`,
      date: newRecord.date,
      teacherName: selectedTeacher.name,
      courseName: newRecord.courseName,
      courseType: newRecord.courseType,
      attendedHours: hours,
      baseHourlyCost: costPerHour,
      totalCost: hours * costPerHour,
      isPaid: false,
      isReimbursed: false,
    }

    setTeacherRecords([...teacherRecords, record])
    markDirty()

    setIsAddRecordOpen(false)
    setNewRecord({
      date: new Date().toISOString().split("T")[0],
      courseName: "",
      courseType: "大班课" as "大班课" | "答疑课",
      hours: "1",
      costPerHour: "1200",
    })
  }

  const handleRebuildRecords = () => {
    const confirmed = confirm("此操作将从学员消课数据重建所有授课记录，现有的授课记录将被覆盖。是否继续？")
    if (!confirmed) return

    console.log("[v0] Starting rebuild from student data...")

    const newRecords: TeacherRecord[] = []
    const processedCourses = new Set<string>()

    students.forEach((student) => {
      student.courses?.forEach((course) => {
        const attendedHours = Number(course.attendedHours || 0)
        if (attendedHours <= 0) return

        const teacherName = course.teacherName || course.assignedTeacher || "未指定"
        const teacher = teachers.find((t) => t.name === teacherName)
        const costPerHour = teacher?.customBaseSalary || 1200

        if (course.type === "大班课") {
          const courseKey = `${student.grade}-${course.name}-${course.type}-${teacherName}`
          if (processedCourses.has(courseKey)) {
            return
          }
          processedCourses.add(courseKey)

          console.log("[v0] Creating group class record:", {
            course: course.name,
            teacher: teacherName,
            hours: attendedHours,
          })
        } else {
          console.log("[v0] Creating tutoring record:", {
            student: student.name,
            course: course.name,
            teacher: teacherName,
            hours: attendedHours,
          })
        }

        newRecords.push({
          id: generateId(),
          date: new Date().toISOString().split("T")[0],
          teacherName,
          courseName: course.name,
          courseType: course.type,
          attendedHours,
          baseHourlyCost: costPerHour,
          totalCost: attendedHours * costPerHour,
          isPaid: false,
          isReimbursed: false,
        })
      })
    })

    console.log("[v0] Rebuild complete, created records:", newRecords.length)

    setTeacherRecords(newRecords)
    markDirty()
    alert(`成功从学员数据重建 ${newRecords.length} 条授课记录`)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>老师授课情况查询</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {viewMode !== "all" && (
              <div>
                <label className="text-sm font-medium mb-2 block">选择老师</label>
                <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="请选择老师" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem key="all" value="all">
                      所有老师
                    </SelectItem>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.name} - {teacher.level || "未定级"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant={viewMode === "overview" ? "default" : "outline"}
                onClick={() => {
                  setViewMode("overview")
                  if (!selectedTeacherId && teachers.length > 0) {
                    setSelectedTeacherId(teachers[0].id)
                  }
                }}
                disabled={viewMode !== "all" && !selectedTeacherId}
              >
                总体情况
              </Button>
              <Button
                variant={viewMode === "monthly" ? "default" : "outline"}
                onClick={() => {
                  setViewMode("monthly")
                  if (!selectedTeacherId && teachers.length > 0) {
                    setSelectedTeacherId(teachers[0].id)
                  }
                }}
                disabled={viewMode !== "all" && !selectedTeacherId}
              >
                月度统计
              </Button>
              <Button variant={viewMode === "all" ? "default" : "outline"} onClick={() => setViewMode("all")}>
                全部老师
              </Button>

              {selectedTeacherId && viewMode !== "all" && (
                <>
                  <Dialog open={isAddRecordOpen} onOpenChange={setIsAddRecordOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="ml-auto bg-transparent">
                        <Plus className="h-4 w-4 mr-2" />
                        添加授课记录
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>添加授课记录</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>授课日期</Label>
                          <Input
                            type="date"
                            value={newRecord.date.replace(/\//g, "-")}
                            onChange={(e) => setNewRecord({ ...newRecord, date: e.target.value.replace(/-/g, "/") })}
                          />
                        </div>
                        <div>
                          <Label>课程名称</Label>
                          <Input
                            value={newRecord.courseName}
                            onChange={(e) => setNewRecord({ ...newRecord, courseName: e.target.value })}
                            placeholder="请输入课程名称"
                          />
                        </div>
                        <div>
                          <Label>课程类型</Label>
                          <Select
                            value={newRecord.courseType}
                            onValueChange={(v) => setNewRecord({ ...newRecord, courseType: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="大班课">大班课</SelectItem>
                              <SelectItem value="答疑课">答疑课</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>授课课时</Label>
                          <Input
                            type="number"
                            step="0.5"
                            value={newRecord.hours}
                            onChange={(e) => setNewRecord({ ...newRecord, hours: e.target.value })}
                            placeholder="请输入课时数"
                          />
                        </div>
                        <div>
                          <Label>课时课酬（元/课时）</Label>
                          <Input
                            type="number"
                            value={newRecord.costPerHour}
                            onChange={(e) => setNewRecord({ ...newRecord, costPerHour: e.target.value })}
                            placeholder="请输入课酬"
                          />
                        </div>
                        <Button onClick={handleAddRecord} className="w-full">
                          确认添加
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button variant="outline" onClick={handleCleanupRecords} className="bg-transparent">
                    清理无效记录
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleRebuildRecords}
                    className="bg-orange-500/10 text-orange-600 hover:bg-orange-500/20"
                  >
                    从学员数据重建
                  </Button>
                </>
              )}
            </div>

            {(viewMode === "monthly" || viewMode === "all") && (
              <div>
                <label className="text-sm font-medium mb-2 block">选择月份</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                      <Calendar className="mr-2 h-4 w-4" />
                      {new Date(selectedMonth).toLocaleDateString("zh-CN", { year: "numeric", month: "long" })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    {/* Calendar component here */}
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {viewMode === "all" && allTeachersMonthlyStats && (
              <div className="mt-6">
                <Card className="mb-4 bg-purple-50">
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-semibold mb-4">
                      {allTeachersMonthlyStats.year}年{allTeachersMonthlyStats.month}月 全部老师授课统计
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-gray-600">授课老师数</div>
                        <div className="text-2xl font-bold text-purple-600">
                          {allTeachersMonthlyStats.teacherCount}人
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">总授课课时</div>
                        <div className="text-2xl font-bold text-blue-600">
                          {allTeachersMonthlyStats.totalAllHours.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">总应付课酬</div>
                        <div className="text-2xl font-bold text-green-600">
                          ¥{allTeachersMonthlyStats.totalAllCost.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {allTeachersMonthlyStats.teachers.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg mb-3">各老师授课明细</h3>
                    {allTeachersMonthlyStats.teachers.map((teacher, index) => (
                      <Card key={index} className="hover:shadow-md transition-shadow">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h4 className="font-semibold text-xl">{teacher.teacherName}</h4>
                              <Badge variant="outline" className="mt-1">
                                {teacher.courseCount} 门课程
                              </Badge>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-gray-600">应付课酬</div>
                              <div className="text-2xl font-bold text-green-600">¥{teacher.totalCost.toFixed(2)}</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                              <div className="text-sm text-gray-600">授课课时</div>
                              <div className="text-lg font-semibold text-blue-600">{teacher.totalHours.toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-600">平均课酬</div>
                              <div className="text-lg font-semibold text-orange-600">
                                ¥{(teacher.totalCost / teacher.totalHours).toFixed(2)}/课时
                              </div>
                            </div>
                          </div>

                          <div>
                            <div className="text-sm text-gray-600 mb-2">授课课程</div>
                            <div className="space-y-2">
                              {teacher.courses.map((course, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{course.courseName}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {course.courseType}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-3 text-sm">
                                    <span className="text-blue-600">{course.hours.toFixed(2)}课时</span>
                                    <span className="text-green-600 font-medium">¥{course.cost.toFixed(2)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    {allTeachersMonthlyStats.year}年{allTeachersMonthlyStats.month}月 暂无授课记录
                  </div>
                )}
              </div>
            )}

            {selectedTeacherId && viewMode === "overview" && (
              <div className="mt-6">
                <Card className="mb-4 bg-blue-50">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-gray-600">总计签约课时</div>
                        <div className="text-2xl font-bold text-blue-600">{totalStats.totalHours.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">累计已消课时</div>
                        <div className="text-2xl font-bold text-green-600">{totalStats.consumedHours.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">剩余课时</div>
                        <div className="text-2xl font-bold text-orange-600">{totalStats.remainingHours.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">授课学生数</div>
                        <div className="text-2xl font-bold text-purple-600">{totalStats.studentCount}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {teacherCourseStats.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg mb-3">课程明细</h3>
                    {teacherCourseStats.map((course, index) => (
                      <Card key={index} className="hover:shadow-md transition-shadow">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h4 className="font-semibold text-lg">{course.courseName}</h4>
                              <Badge
                                variant={course.courseType === "大班课" ? "default" : "secondary"}
                                className="mt-1"
                              >
                                {course.courseType}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-gray-600">授课学生</div>
                              <div className="text-xl font-bold">{course.studentCount}人</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4 mb-3">
                            <div>
                              <div className="text-sm text-gray-600">总计课时</div>
                              <div className="text-lg font-semibold">{course.totalHours.toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-600">已消课时</div>
                              <div className="text-lg font-semibold text-green-600">
                                {course.consumedHours.toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-600">剩余课时</div>
                              <div className="text-lg font-semibold text-orange-600">
                                {course.remainingHours.toFixed(2)}
                              </div>
                            </div>
                          </div>

                          <div>
                            <div className="text-sm text-gray-600 mb-1">授课学生名单</div>
                            <div className="flex flex-wrap gap-2">
                              {course.students.map((studentName, idx) => (
                                <Badge key={idx} variant="outline">
                                  {studentName}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">该老师暂无授课记录</div>
                )}
              </div>
            )}

            {selectedTeacherId && viewMode === "monthly" && monthlyStats && (
              <div className="mt-6">
                <Card className="mb-4 bg-green-50">
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-semibold mb-4">
                      {monthlyStats.year}年{monthlyStats.month}月授课统计
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-gray-600">授课课时</div>
                        <div className="text-2xl font-bold text-blue-600">{monthlyStats.totalHours.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">应付课酬</div>
                        <div className="text-2xl font-bold text-green-600">¥{monthlyStats.totalCost.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">授课课程数</div>
                        <div className="text-2xl font-bold text-purple-600">{monthlyStats.courses.length}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {monthlyStats.courses.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg mb-3">课程明细</h3>
                    {monthlyStats.courses.map((course, index) => (
                      <Card key={index} className="hover:shadow-md transition-shadow">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h4 className="font-semibold text-lg">{course.courseName}</h4>
                              <Badge
                                variant={course.courseType === "大班课" ? "default" : "secondary"}
                                className="mt-1"
                              >
                                {course.courseType}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-gray-600">授课课时</div>
                              <div className="text-xl font-bold">{course.totalHours.toFixed(2)}</div>
                            </div>
                          </div>

                          <div className="mb-3">
                            <div className="text-sm text-gray-600">应付课酬</div>
                            <div className="text-2xl font-semibold text-green-600">¥{course.totalCost.toFixed(2)}</div>
                          </div>

                          <div>
                            <div className="text-sm text-gray-600 mb-2">授课记录</div>
                            <div className="space-y-2">
                              {course.records.map((record) => (
                                <div
                                  key={record.id}
                                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                      <span className="font-medium">{record.date}</span>
                                      <Badge variant="outline" className="text-xs">
                                        {record.attendedHours}课时
                                      </Badge>
                                      <span className="text-sm text-gray-600">¥{record.baseHourlyCost}/课时</span>
                                    </div>
                                    <div className="text-sm text-gray-500 mt-1">
                                      课酬：¥{(record.totalCost || 0).toFixed(2)}
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleDeleteRecord(record.id || "")}
                                  >
                                    删除
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    该老师在 {monthlyStats.year}年{monthlyStats.month}月 暂无授课记录
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
