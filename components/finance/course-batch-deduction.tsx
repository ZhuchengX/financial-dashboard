"use client"

import { CardDescription } from "@/components/ui/card"

import { useState, useMemo, useEffect } from "react"
import type { Student, TeacherRecord, Teacher, CoursePreset } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { generateId } from "@/lib/id"
import { BookOpen, Clock, DollarSign, TrendingUp, Calendar, Trash2, X } from "lucide-react"
import { Plus } from "lucide-react" // Import Plus component
import { format } from "date-fns"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

interface CourseBatchDeductionProps {
  students: Student[]
  teachers: Teacher[]
  teacherRecords: TeacherRecord[]
  coursePresets: CoursePreset[]
  setStudents: (students: Student[]) => void
  setTeacherRecords: (records: TeacherRecord[]) => void
  notify: (message: string, type: "success" | "error" | "info") => void
  markDirty: () => void
}

export function CourseBatchDeduction({
  students,
  teachers,
  teacherRecords,
  coursePresets,
  setStudents,
  setTeacherRecords,
  notify,
  markDirty,
}: CourseBatchDeductionProps) {
  const [selectedMajor, setSelectedMajor] = useState("")
  const [selectedGrade, setSelectedGrade] = useState("")
  const [selectedSemester, setSelectedSemester] = useState("")
  const [selectedCourseName, setSelectedCourseName] = useState("")
  const [selectedCourseType, setSelectedCourseType] = useState("")
  const [deductionHours, setDeductionHours] = useState("1")
  const [teachingDate, setTeachingDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [teacherEntries, setTeacherEntries] = useState<TeacherEntry[]>([])
  const [showSuccessAlert, setShowSuccessAlert] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")
  const [deductionStudents, setDeductionStudents] = useState<
    Array<{ id: string; name: string; grade: string; major: string; hourlyRate: number }>
  >([])
  const [showAddStudentDialog, setShowAddStudentDialog] = useState(false)

  const majors = useMemo(() => {
    const majorSet = new Set(students.map((s) => s.major))
    return Array.from(majorSet).sort()
  }, [students])

  const grades = useMemo(() => {
    if (!selectedMajor) return []
    const gradeSet = new Set(students.filter((s) => s.major === selectedMajor).map((s) => s.grade))
    return Array.from(gradeSet).sort()
  }, [students, selectedMajor])

  const semesters = useMemo(() => {
    if (!selectedMajor || !selectedGrade) return []
    const semesterSet = new Set(
      students
        .filter((s) => s.major === selectedMajor && s.grade === selectedGrade)
        .flatMap((s) => s.courses.map((c) => c.semester))
        .filter(Boolean),
    )
    return Array.from(semesterSet).sort()
  }, [students, selectedMajor, selectedGrade])

  const availableCourses = useMemo(() => {
    if (!selectedMajor || !selectedGrade) return []

    const courseMap = new Map<string, { name: string; type: string }>()
    students
      .filter((s) => s.major === selectedMajor && s.grade === selectedGrade)
      .forEach((student) => {
        student.courses
          .filter((course) => !selectedSemester || course.semester === selectedSemester)
          .forEach((course) => {
            const key = `${course.name}-${course.type}`
            if (!courseMap.has(key)) {
              courseMap.set(key, {
                name: course.name,
                type: course.type,
              })
            }
          })
      })

    return Array.from(courseMap.values())
  }, [students, selectedMajor, selectedGrade, selectedSemester])

  const selectedCourse = useMemo<CourseData>(() => {
    let defaultTeacherName = ""
    let teacherBasePay = 0

    if (selectedCourseName && selectedCourseType) {
      // 从课程配置包中查找匹配的课程（按年级和学期，不考虑专业）
      const matchingPreset = coursePresets.find(
        (p: any) =>
          p.name === selectedCourseName &&
          p.type === selectedCourseType &&
          p.grade === selectedGrade &&
          (!selectedSemester || p.semester === selectedSemester),
      )

      if (matchingPreset) {
        defaultTeacherName = matchingPreset.defaultTeacher || ""

        // 从在库老师列表获取最新课酬
        if (defaultTeacherName) {
          const teacherInList = teachers.find((t) => t.name === defaultTeacherName)
          if (teacherInList && teacherInList.customBaseSalary) {
            teacherBasePay = Number.parseFloat(teacherInList.customBaseSalary) || 0
          } else {
            teacherBasePay = matchingPreset.defaultCost || 0
          }
        }
      }
    }

    const courseData: CourseData = {
      name: selectedCourseName,
      type: selectedCourseType,
      totalHours: 0,
      attendedHours: 0,
      studentCount: 0,
      students: [] as Array<{ id: string; name: string; grade: string; major: string; hourlyRate: number }>,
      defaultTeacher: defaultTeacherName,
      defaultCost: teacherBasePay,
    }

    students
      .filter((s) => s.grade === selectedGrade)
      .forEach((student) => {
        const matchingCourse = student.courses.find(
          (c) =>
            c.name === selectedCourseName &&
            c.type === selectedCourseType &&
            (!selectedSemester || c.semester === selectedSemester),
        )
        if (matchingCourse) {
          courseData.totalHours = Math.max(courseData.totalHours, matchingCourse.totalHours)
          courseData.attendedHours = Math.max(courseData.attendedHours, matchingCourse.attendedHours)
          courseData.studentCount++
          courseData.students.push({
            id: student.id,
            name: student.name,
            grade: student.grade,
            major: student.major,
            hourlyRate: matchingCourse.hourlyRate || 0,
          })
        }
      })

    return courseData
  }, [selectedCourseName, selectedCourseType, selectedGrade, selectedSemester, students, coursePresets, teachers])

  useEffect(() => {
    if (selectedCourse && selectedCourse.defaultTeacher) {
      const teacherFromList = teachers.find((t) => t.name === selectedCourse.defaultTeacher)
      const latestCost = teacherFromList?.customBaseSalary
        ? Number(teacherFromList.customBaseSalary)
        : selectedCourse.defaultCost

      setTeacherEntries([
        {
          id: generateId(),
          name: selectedCourse.defaultTeacher,
          role: "主讲老师",
          hours: deductionHours,
          cost: latestCost.toString(),
          tierIndex: teacherFromList?.tierIndex || 0,
        },
      ])
    } else if (selectedCourse) {
      setTeacherEntries([])
    }
  }, [selectedCourse, teachers])

  useEffect(() => {
    if (selectedCourse.students.length > 0) {
      setDeductionStudents([...selectedCourse.students])
    } else {
      setDeductionStudents([])
    }
  }, [selectedCourse.students])

  const availableStudentsToAdd = useMemo(() => {
    if (!selectedGrade || !selectedCourseName) return []

    const sameGradeStudents = students.filter((s) => s.grade === selectedGrade)

    const currentStudentIds = new Set(deductionStudents.map((s) => s.id))

    return sameGradeStudents
      .filter((s) => !currentStudentIds.has(s.id))
      .map((student) => {
        const matchingCourse = student.courses.find(
          (c) => c.name === selectedCourseName && c.type === selectedCourseType,
        )
        return {
          id: student.id,
          name: student.name,
          grade: student.grade,
          major: student.major,
          hourlyRate: matchingCourse?.hourlyRate || 0,
        }
      })
  }, [students, selectedGrade, selectedCourseName, selectedCourseType, deductionStudents])

  const handleRemoveStudent = (studentId: string) => {
    setDeductionStudents((prev) => prev.filter((s) => s.id !== studentId))
  }

  const handleAddStudent = (student: {
    id: string
    name: string
    grade: string
    major: string
    hourlyRate: number
  }) => {
    setDeductionStudents((prev) => [...prev, student])
    setShowAddStudentDialog(false)
  }

  const handleBatchDeduction = () => {
    if (!selectedCourseName || !selectedCourseType) {
      notify("请先选择课程", "error")
      return
    }

    if (deductionStudents.length === 0) {
      notify("本次消课没有学员", "error")
      return
    }

    const hours = Number.parseFloat(deductionHours)
    if (Number.isNaN(hours) || hours <= 0) {
      notify("请输入有效的消课课时", "error")
      return
    }

    const updatedStudents = students.map((student) => {
      const isInDeductionList = deductionStudents.some((ds) => ds.id === student.id)
      if (!isInDeductionList) return student

      const courseIndex = student.courses.findIndex(
        (c) =>
          c.name === selectedCourseName &&
          c.type === selectedCourseType &&
          (!selectedSemester || c.semester === selectedSemester),
      )

      if (courseIndex === -1) return student

      const updatedCourses = [...student.courses]
      updatedCourses[courseIndex] = {
        ...updatedCourses[courseIndex],
        attendedHours: updatedCourses[courseIndex].attendedHours + hours,
      }

      return {
        ...student,
        courses: updatedCourses,
      }
    })

    const newTeacherRecords: TeacherRecord[] = teacherEntries.map((entry) => ({
      id: generateId(),
      date: teachingDate,
      teacherName: entry.name,
      courseName: selectedCourseName,
      courseType: selectedCourseType,
      attendedHours: Number.parseFloat(entry.hours) || 0,
      baseHourlyCost: Number.parseFloat(entry.cost) || 0,
      bonusAmount: 0,
      totalCost: (Number.parseFloat(entry.hours) || 0) * (Number.parseFloat(entry.cost) || 0),
      status: "pending",
      isAuto: true,
      projectTag: "",
    }))

    setStudents(updatedStudents)
    setTeacherRecords([...teacherRecords, ...newTeacherRecords])
    markDirty()

    const studentNames = deductionStudents.map((s) => s.name).join("、")
    const teacherNames = teacherEntries.map((e) => e.name).join("、")
    const totalRevenue = deductionStudents.reduce((sum, s) => sum + s.hourlyRate * hours, 0)
    const message = `消课成功！
课程：${selectedCourseName}（${selectedCourseType}）
授课日期：${teachingDate}
消课课时：${hours} 课时
授课老师：${teacherNames}
课程学员（${deductionStudents.length}人）：${studentNames}
本次收入：¥${totalRevenue.toLocaleString()}`

    setSuccessMessage(message)
    setShowSuccessAlert(true)
    setTimeout(() => setShowSuccessAlert(false), 8000)

    notify(`消课成功：${selectedCourseName}（${selectedCourseType}）- ${deductionStudents.length}人`, "success")
  }

  const handleAddTeacher = () => {
    if (!teachers || teachers.length === 0) {
      notify("师资库为空，无法添加教师", "error")
      return
    }

    setTeacherEntries([
      ...teacherEntries,
      {
        id: generateId(),
        name: "",
        role: "协助老师",
        hours: deductionHours,
        cost: "0",
        tierIndex: 0,
      },
    ])
  }

  const handleRemoveTeacher = (id: number) => {
    setTeacherEntries(teacherEntries.filter((entry) => entry.id !== id))
  }

  const handleUpdateTeacher = (id: number, field: keyof TeacherEntry, value: string | number) => {
    setTeacherEntries(
      teacherEntries.map((entry) => {
        if (entry.id === id) {
          if (field === "name" && typeof value === "string") {
            const teacher = teachers.find((t) => t.name === value)
            if (teacher) {
              const baseSalary = teacher.customBaseSalary ? Number.parseFloat(teacher.customBaseSalary) : 0
              return {
                ...entry,
                [field]: value,
                cost: baseSalary.toString(),
                tierIndex: teacher.tierIndex,
              }
            }
          }
          return { ...entry, [field]: value }
        }
        return entry
      }),
    )
  }

  useMemo(() => {
    if (deductionHours) {
      setTeacherEntries((prev) =>
        prev.map((entry) => ({
          ...entry,
          hours: entry.hours === "" || entry.hours === prev[0]?.hours ? deductionHours : entry.hours,
        })),
      )
    }
  }, [deductionHours])

  const courseFinancials = useMemo(() => {
    const revenue = deductionStudents.reduce((sum, student) => {
      return sum + student.hourlyRate * Number.parseFloat(deductionHours)
    }, 0)

    const cost = selectedCourse.defaultCost * Number.parseFloat(deductionHours)

    const profit = revenue - cost

    return { revenue, cost, profit }
  }, [deductionStudents, selectedCourse, deductionHours])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            课程筛选
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label>专业（用于快速定位）</Label>
              <Select
                value={selectedMajor}
                onValueChange={(value) => {
                  setSelectedMajor(value === "default" ? "" : value)
                  setSelectedGrade("")
                  setSelectedSemester("")
                  setSelectedCourseName("")
                  setSelectedCourseType("")
                }}
              >
                <SelectTrigger className="w-full mt-1 px-3 py-2 border rounded-md">
                  <SelectValue placeholder="请选择专业" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">请选择专业</SelectItem>
                  {majors.map((major) => (
                    <SelectItem key={major} value={major}>
                      {major}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>年级</Label>
              <Select
                value={selectedGrade}
                onValueChange={(value) => {
                  setSelectedGrade(value === "default" ? "" : value)
                  setSelectedSemester("")
                  setSelectedCourseName("")
                  setSelectedCourseType("")
                }}
                disabled={!selectedMajor}
              >
                <SelectTrigger className="w-full mt-1 px-3 py-2 border rounded-md">
                  <SelectValue placeholder="请选择年级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">请选择年级</SelectItem>
                  {grades.map((grade) => (
                    <SelectItem key={grade} value={grade}>
                      {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>学期（可选）</Label>
              <Select
                value={selectedSemester}
                onValueChange={(value) => {
                  setSelectedSemester(value === "default" ? "" : value)
                  setSelectedCourseName("")
                  setSelectedCourseType("")
                }}
                disabled={!selectedGrade}
              >
                <SelectTrigger className="w-full mt-1 px-3 py-2 border rounded-md">
                  <SelectValue placeholder="全部学期" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">全部学期</SelectItem>
                  {semesters.map((semester) => (
                    <SelectItem key={semester} value={semester}>
                      {semester}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>课程名称</Label>
              <Select
                value={selectedCourseName && selectedCourseType ? `${selectedCourseName}-${selectedCourseType}` : ""}
                onValueChange={(value) => {
                  if (value === "default" || !value) {
                    setSelectedCourseName("")
                    setSelectedCourseType("")
                  } else {
                    const course = availableCourses.find((c) => `${c.name}-${c.type}` === value)
                    if (course) {
                      setSelectedCourseName(course.name)
                      setSelectedCourseType(course.type)
                    }
                  }
                }}
                disabled={!selectedGrade}
              >
                <SelectTrigger className="w-full mt-1 px-3 py-2 border rounded-md">
                  <SelectValue placeholder="请选择课程" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">请选择课程</SelectItem>
                  {availableCourses.map((course) => (
                    <SelectItem key={`${course.name}-${course.type}`} value={`${course.name}-${course.type}`}>
                      {course.name} ({course.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedCourse && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">总课时</p>
                    <p className="text-2xl font-bold text-blue-600">{selectedCourse.totalHours.toFixed(2)}课时</p>
                  </div>
                  <Clock className="w-8 h-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">已授课时</p>
                    <p className="text-2xl font-bold text-green-600">{selectedCourse.attendedHours.toFixed(2)}课时</p>
                  </div>
                  <BookOpen className="w-8 h-8 text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">已给课时费（成本）</p>
                    <p className="text-2xl font-bold text-orange-600">¥{courseFinancials.cost.toLocaleString()}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-orange-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">课程收入</p>
                    <p className="text-2xl font-bold text-green-600">¥{courseFinancials.revenue.toLocaleString()}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">课程利润</p>
                    <p
                      className={`text-2xl font-bold ${courseFinancials.profit >= 0 ? "text-purple-600" : "text-red-600"}`}
                    >
                      ¥{courseFinancials.profit.toLocaleString()}
                    </p>
                  </div>
                  <TrendingUp
                    className={`w-8 h-8 ${courseFinancials.profit >= 0 ? "text-purple-400" : "text-red-400"}`}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>课程学员名单 ({deductionStudents.length}人)</span>
                <Dialog open={showAddStudentDialog} onOpenChange={setShowAddStudentDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs bg-transparent">
                      <Plus className="h-3 w-3 mr-1" />
                      添加学员
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>添加学员到本次消课</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[400px] overflow-y-auto">
                      {availableStudentsToAdd.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">没有其他同年级的学员可添加</p>
                      ) : (
                        <div className="space-y-2">
                          {availableStudentsToAdd.map((student) => (
                            <div
                              key={student.id}
                              className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 cursor-pointer"
                              onClick={() => handleAddStudent(student)}
                            >
                              <div>
                                <span className="font-medium">{student.name}</span>
                                <span className="text-xs text-gray-500 ml-2">
                                  ({student.grade} {student.major})
                                </span>
                              </div>
                              <Button variant="ghost" size="sm" className="h-6 text-xs">
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {deductionStudents.map((student) => (
                  <div
                    key={student.id}
                    className="px-3 py-2 bg-gray-50 rounded border border-gray-200 text-sm hover:bg-gray-100 flex items-center justify-between group"
                  >
                    <div className="font-medium">
                      {student.name}
                      <span className="text-xs text-gray-500 ml-2">
                        ({student.grade} {student.major})
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleRemoveStudent(student.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              {deductionStudents.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">暂无学员，请点击"添加学员"按钮添加</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                批量消课
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <Label>消课课时</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={deductionHours}
                    onChange={(e) => setDeductionHours(e.target.value)}
                    placeholder="输入本次授课课时（如1.00、0.66）"
                    className="mt-1"
                  />
                </div>

                <div className="flex-1">
                  <Label>授课日期</Label>
                  <Input
                    type="date"
                    value={teachingDate}
                    onChange={(e) => setTeachingDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">授课老师信息</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddTeacher}
                    className="flex items-center gap-1 bg-transparent"
                  >
                    <Plus className="w-4 h-4" />
                    添加老师
                  </Button>
                </div>

                {teacherEntries.map((entry, index) => (
                  <div key={entry.id} className="flex items-end gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <Label className="text-xs">老师姓名</Label>
                      <Select
                        value={entry.name}
                        onValueChange={(value) => handleUpdateTeacher(entry.id, "name", value)}
                      >
                        <SelectTrigger className="w-full mt-1 px-2 py-1.5 text-sm border rounded">
                          <SelectValue placeholder="选择老师" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">选择老师</SelectItem>
                          {teachers.map((teacher) => (
                            <SelectItem key={teacher.id} value={teacher.name}>
                              {teacher.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-24">
                      <Label className="text-xs">角色</Label>
                      <Select
                        value={entry.role}
                        onValueChange={(value) => handleUpdateTeacher(entry.id, "role", value)}
                      >
                        <SelectTrigger className="w-full mt-1 px-2 py-1.5 text-sm border rounded">
                          <SelectValue placeholder="选择角色" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="主讲老师">主讲老师</SelectItem>
                          <SelectItem value="协助老师">协助老师</SelectItem>
                          <SelectItem value="助教老师">助教老师</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-28">
                      <Label className="text-xs">授课时长</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={entry.hours}
                        onChange={(e) => handleUpdateTeacher(entry.id, "hours", e.target.value)}
                        placeholder="课时"
                        className="mt-1 text-sm"
                      />
                    </div>

                    <div className="w-28">
                      <Label className="text-xs">课酬(元/h)</Label>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        value={entry.cost}
                        onChange={(e) => handleUpdateTeacher(entry.id, "cost", e.target.value)}
                        placeholder="课酬"
                        className="mt-1 text-sm"
                      />
                    </div>

                    <div className="w-24 text-sm text-gray-600 pb-1.5">
                      ¥{(Number.parseFloat(entry.hours || "0") * Number.parseFloat(entry.cost || "0")).toFixed(2)}
                    </div>

                    {teacherEntries.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveTeacher(entry.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}

                <p className="text-xs text-gray-500">
                  总课时费：¥
                  {teacherEntries
                    .reduce((sum, entry) => {
                      return sum + Number.parseFloat(entry.hours || "0") * Number.parseFloat(entry.cost || "0")
                    }, 0)
                    .toFixed(2)}
                </p>
              </div>

              <Button onClick={handleBatchDeduction} className="w-full bg-blue-600 hover:bg-blue-700">
                确认消课
              </Button>

              <p className="text-sm text-gray-500 text-center">
                {deductionStudents.length > 0
                  ? `将为该课程下的 ${deductionStudents.length} 名学员同时消课，并自动生成教师授课记录`
                  : "将记录教师授课信息（当前无学员报名该课程）"}
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {!selectedCourse && selectedGrade && (
        <Card>
          <CardHeader>
            <CardTitle>未找到课程</CardTitle>
            <CardDescription>该课程暂无学员报名，但您仍然可以添加课程配置包后记录教师授课信息</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  )
}

interface CourseData {
  name: string
  type: string
  totalHours: number
  attendedHours: number
  studentCount: number
  students: Array<{ id: string; name: string; grade: string; major: string; hourlyRate: number }>
  defaultTeacher: string
  defaultCost: number
}

interface TeacherEntry {
  id: number
  name: string
  role: string
  hours: string
  cost: string
  tierIndex: number
}
