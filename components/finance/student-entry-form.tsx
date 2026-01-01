"use client"

import type React from "react"
import { useState, useMemo, useCallback, useEffect } from "react"
import { Copy, Save, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import type { Student, PresetData, Expense, PresetCourse, Teacher } from "@/types"
import { ACCOUNT_TYPES, EXPENSE_STATUS, GRADES, MAJORS, SEMESTERS } from "@/lib/constants"
import { generateId, sortStudents } from "@/lib/utils/helpers"

type StudentEntryFormProps = {
  students: Student[]
  setStudents: (students: Student[]) => void
  expenses: Expense[]
  setExpenses: (expenses: Expense[]) => void
  presetData: PresetData
  setPresetData: (data: PresetData) => void
  teachers: Teacher[] // Added teachers prop for matching
  markDirty: () => void
  notify: (message: string, type?: "success" | "error" | "info") => void
}

export function StudentEntryForm({
  students,
  setStudents,
  expenses,
  setExpenses,
  presetData,
  setPresetData,
  teachers, // Added teachers prop
  markDirty,
  notify,
}: StudentEntryFormProps) {
  const [form, setForm] = useState({
    name: "",
    grade: "2024级",
    major: "数学与应用数学D",
    semester: "第二学年第一学期",
    isPaid: true,
    paymentDate: new Date().toISOString().split("T")[0],
    selectedCourses: [] as Array<
      PresetCourse & {
        selected: boolean
        editHours: number
        editRate: number
        assignedTeacher: string
        assignedTierIndex: number
        assignedCost: number
      }
    >,
    batchTeacher: "",
    batchTier: "T5",
    batchCost: 600,
    referrer: "",
    referrerRate: 15,
    closer: "",
    closerRate: 15,
    memberType: "Normal" as "Normal" | "Core" | "Base",
  })

  const [copyTargetId, setCopyTargetId] = useState("")
  const [studentToDelete, setStudentToDelete] = useState("")

  // Get semesters for copy target
  const copyTargetSemesters = useMemo(() => {
    if (!copyTargetId) return []
    const target = students.find((s) => s.id === copyTargetId)
    if (!target) return []
    return Array.from(new Set(target.courses.map((c) => c.semester))).sort()
  }, [copyTargetId, students])

  const handleCopyStudentSemester = useCallback(
    (semester: string) => {
      const target = students.find((s) => s.id === copyTargetId)
      if (!target) return

      const selectedCourses = target.courses
        .filter((c) => c.semester === semester)
        .map((c) => ({
          ...c,
          selected: true,
          editHours: c.hours,
          editRate: c.rate,
          assignedTeacher: c.teacherName || "",
          assignedTierIndex: c.teacherTierIndex || 4,
          assignedCost: c.teacherBaseCost || 0,
        }))

      setForm((prev) => ({ ...prev, selectedCourses }))
      notify(`已复制 ${semester} 的课程到 ${form.name}`, "success")
    },
    [copyTargetId, students, notify],
  )

  useEffect(() => {
    if (form.grade && form.major && form.semester) {
      const majorData = presetData[form.major]
      if (majorData) {
        const gradeData = majorData[form.grade]
        if (gradeData) {
          const semesterCourses = gradeData[form.semester]
          if (semesterCourses && semesterCourses.length > 0) {
            const courses = semesterCourses.map((preset) => ({
              ...preset,
              selected: true,
              editHours: preset.hours,
              editRate: preset.rate,
              assignedTeacher: preset.defaultTeacher || "",
              assignedTierIndex: 4,
              assignedCost: preset.defaultCost || 0,
            }))
            setForm((prev) => ({ ...prev, selectedCourses: courses }))
          }
        }
      }
    }
  }, [form.grade, form.major, form.semester, presetData])

  useEffect(() => {
    const studentsToUpdate = students.filter(
      (s) => (s.name === "王一君" || s.name === "文尚杰") && s.memberType !== "Base",
    )

    if (studentsToUpdate.length > 0) {
      const updatedStudents = students.map((student) => {
        if (student.name === "王一君" || student.name === "文尚杰") {
          return { ...student, memberType: "Base" as const }
        }
        return student
      })
      setStudents(updatedStudents)
      markDirty()
    }
  }, [students, setStudents, markDirty])

  const handleBatchSetTeacher = useCallback(() => {
    if (!form.batchTeacher.trim()) {
      notify("请输入教师姓名", "error")
      return
    }

    const tierIndex = Number.parseInt(form.batchTier.replace("T", "")) - 1
    setForm((prev) => ({
      ...prev,
      selectedCourses: prev.selectedCourses.map((c) =>
        c.selected
          ? {
              ...c,
              assignedTeacher: prev.batchTeacher,
              assignedTierIndex: tierIndex,
              assignedCost: prev.batchCost,
            }
          : c,
      ),
    }))

    notify("已批量设置教师", "success")
  }, [form.batchTeacher, form.batchTier, form.batchCost, notify])

  // Delete student
  const handleDeleteStudent = () => {
    if (!studentToDelete) return
    const target = students.find((s) => s.id === studentToDelete)
    if (!target) return

    if (
      window.confirm(
        `严重警告：\n\n您确定要删除学员【${target.name}】的所有档案吗？\n\n此操作将永久删除该学员的所有课程记录，且无法撤销！`,
      )
    ) {
      const newStudents = students.filter((s) => s.id !== studentToDelete)
      setStudents(newStudents)
      setStudentToDelete("")
      markDirty()
      notify(`学员 ${target.name} 已成功删除。`, "success")
    }
  }

  // Calculate course summary
  const courseSummary = useMemo(() => {
    const selected = form.selectedCourses.filter((c) => c.selected)
    const largeClassHours = selected
      .filter((c) => c.type === "大班课" || c.name.includes("大班"))
      .reduce((sum, c) => sum + c.editHours, 0)
    const otherHours = selected
      .filter((c) => c.type !== "大班课" && !c.name.includes("大班"))
      .reduce((sum, c) => sum + c.editHours, 0)
    const totalHours = largeClassHours + otherHours
    const largeClassRevenue = selected
      .filter((c) => c.type === "大班课" || c.name.includes("大班"))
      .reduce((sum, c) => sum + c.editHours * c.editRate, 0)
    const otherRevenue = selected
      .filter((c) => c.type !== "大班课" && !c.name.includes("大班"))
      .reduce((sum, c) => sum + c.editHours * c.editRate, 0)
    const totalRevenue = largeClassRevenue + otherRevenue

    return {
      largeClassHours,
      otherHours,
      totalHours,
      largeClassRevenue,
      otherRevenue,
      totalRevenue,
    }
  }, [form.selectedCourses])

  // Submit form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.name.trim()) {
      notify("请输入学员姓名", "error")
      return
    }

    const selectedCourses = form.selectedCourses.filter((c) => c.selected)
    if (selectedCourses.length === 0) {
      notify("请至少选择一门课程", "error")
      return
    }

    // Create new courses
    const newCourses = selectedCourses.map((c) => {
      let finalHourlyRate = Number(c.editRate)
      let finalTotalHours = Number(c.editHours)
      let finalTeacherCost = Number(c.assignedCost)

      const isGroupClass = c.type === "大班课" || c.name.includes("大班")
      const isQnAClass = c.type === "答疑课" || c.name.includes("答疑")

      // Apply member type discounts
      if (form.memberType === "Base") {
        if (isGroupClass) {
          finalHourlyRate = finalHourlyRate * 0.5
        }
      } else if (form.memberType === "Core") {
        if (isGroupClass) {
          finalHourlyRate = 0
        } else if (isQnAClass) {
          finalTotalHours = 0
          finalTeacherCost = 0
        }
      }

      return {
        id: generateId(),
        name: c.name,
        type: c.type,
        semester: form.semester,
        totalHours: finalTotalHours,
        attendedHours: 0,
        hourlyRate: finalHourlyRate,
        totalCost: finalTotalHours * finalHourlyRate,
        isPaid: form.isPaid,
        teacherName: c.assignedTeacher,
        teacherTierIndex: c.assignedTierIndex,
        teacherBaseCost: finalTeacherCost,
        projectTag: `${form.grade}-${form.major}`,
        paymentDate: form.paymentDate,
      }
    })

    // Add or update student
    const existingIndex = students.findIndex((s) => s.name === form.name && s.major === form.major)
    const updatedStudents = [...students]

    if (existingIndex >= 0) {
      updatedStudents[existingIndex].courses.push(...newCourses)
      updatedStudents[existingIndex].memberType = form.memberType
    } else {
      updatedStudents.push({
        id: generateId(),
        name: form.name,
        grade: form.grade,
        major: form.major,
        memberType: form.memberType,
        courses: newCourses,
        referrer: form.referrer,
        referrerRate: form.referrerRate,
        closer: form.closer,
        closerRate: form.closerRate,
      })
    }

    setStudents(updatedStudents)

    // Calculate commissions
    const totalLargeClassTuition = newCourses
      .filter((c) => c.type === "大班课" || c.name.includes("大班"))
      .reduce((sum, c) => sum + c.totalCost, 0)

    const newExpenses = [...expenses]
    const shortMajor = form.major.substring(0, 2)
    const studentInfo = `${shortMajor}${form.grade}${form.name}${form.semester}`

    // Helper to add commission
    const addCommission = (payee: string, rate: number, typeLabel: string) => {
      const totalAmt = totalLargeClassTuition * (rate / 100)

      if (form.memberType === "Core" || form.memberType === "Base") {
        newExpenses.push({
          id: generateId(),
          date: form.paymentDate,
          category: "销售佣金",
          reason: `${typeLabel}提成（${rate}%-全额）：${studentInfo}`,
          amount: totalAmt,
          account: ACCOUNT_TYPES.PAYROLL,
          status: EXPENSE_STATUS.PENDING,
          payee: payee,
          projectTag: `${form.grade}-${form.major}`,
        })
      } else {
        const safeAmt = totalAmt * 0.5
        const riskAmt = totalAmt * 0.5

        newExpenses.push({
          id: generateId(),
          date: form.paymentDate,
          category: "销售佣金",
          reason: `${typeLabel}提成（${rate}%-首）：${studentInfo}`,
          amount: safeAmt,
          account: ACCOUNT_TYPES.PAYROLL,
          status: EXPENSE_STATUS.PENDING,
          payee: payee,
          projectTag: `${form.grade}-${form.major}`,
        })

        newExpenses.push({
          id: generateId(),
          date: form.paymentDate,
          category: "销售佣金",
          reason: `${typeLabel}提成（${rate}%-尾）：${studentInfo}`,
          amount: riskAmt,
          account: ACCOUNT_TYPES.PAYROLL,
          status: EXPENSE_STATUS.PENDING,
          payee: payee,
          projectTag: `${form.grade}-${form.major}`,
        })
      }
    }

    if (form.referrer && form.referrerRate > 0) {
      addCommission(form.referrer, form.referrerRate, "引流")
    }

    if (form.closer && form.closerRate > 0) {
      addCommission(form.closer, form.closerRate, "成交")
    }

    setExpenses(newExpenses)
    markDirty()

    notify(`学员 ${form.name} 已成功添加，共 ${newCourses.length} 门课程！`, "success")

    // Reset form
    setForm({
      name: "",
      grade: "2024级",
      major: "数学与应用数学D",
      semester: "第二学年第一学期",
      isPaid: true,
      paymentDate: new Date().toISOString().split("T")[0],
      selectedCourses: [],
      batchTeacher: "",
      batchTier: "T5",
      batchCost: 600,
      referrer: "",
      referrerRate: 15,
      closer: "",
      closerRate: 15,
      memberType: "Normal",
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Student Info Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>1. 学员信息</CardTitle>
            <div className="flex gap-2">
              {/* Delete student */}
              <div className="flex items-center gap-1 bg-red-50 px-2 py-1 rounded border border-red-200">
                <Select value={studentToDelete} onValueChange={setStudentToDelete}>
                  <SelectTrigger className="h-7 w-[100px] text-xs border-none bg-transparent">
                    <SelectValue placeholder="删除学员..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sortStudents(students).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {studentToDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteStudent}
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                  >
                    ×
                  </Button>
                )}
              </div>

              {/* Copy student */}
              <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                <Copy className="w-3 h-3 text-blue-600" />
                <Select value={copyTargetId} onValueChange={setCopyTargetId}>
                  <SelectTrigger className="h-7 w-[90px] text-xs border-none bg-transparent">
                    <SelectValue placeholder="快速复制..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sortStudents(students).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {copyTargetId && (
                  <Select onValueChange={handleCopyStudentSemester}>
                    <SelectTrigger className="h-7 w-[110px] text-xs border-none bg-transparent">
                      <SelectValue placeholder="选学期..." />
                    </SelectTrigger>
                    <SelectContent>
                      {copyTargetSemesters.map((sem) => (
                        <SelectItem key={sem} value={sem}>
                          {sem}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Basic Info */}
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="学员姓名"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>学员身份</Label>
                <Select
                  value={form.memberType}
                  onValueChange={(value: "Normal" | "Core" | "Base") => setForm({ ...form, memberType: value })}
                >
                  <SelectTrigger className="bg-rose-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Normal">普通学员客户</SelectItem>
                    <SelectItem value="Base">团队基础成员</SelectItem>
                    <SelectItem value="Core">团队核心成员</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>年级</Label>
                <Select value={form.grade} onValueChange={(value) => setForm({ ...form, grade: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADES.map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>专业</Label>
                <Select value={form.major} onValueChange={(value) => setForm({ ...form, major: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAJORS.map((major) => (
                      <SelectItem key={major} value={major}>
                        {major}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>学期</Label>
              <Select value={form.semester} onValueChange={(value) => setForm({ ...form, semester: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEMESTERS.map((sem) => (
                    <SelectItem key={sem} value={sem}>
                      {sem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>批量设置老师 (可选)</Label>
              <div className="flex gap-2">
                <Input
                  value={form.batchTeacher}
                  onChange={(e) => setForm({ ...form, batchTeacher: e.target.value })}
                  placeholder="一键填入"
                  className="flex-1"
                />
              </div>
            </div>

            {/* Commission Settings */}
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-3">
              <p className="text-sm font-medium">销售佣金配置 (仅限大班课，仅量大班费)</p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>推荐/引流人</Label>
                  <Input
                    value={form.referrer}
                    onChange={(e) => setForm({ ...form, referrer: e.target.value })}
                    placeholder="谁推荐的"
                  />
                </div>

                <div className="space-y-2">
                  <Label>佣金(%)</Label>
                  <Input
                    type="number"
                    value={form.referrerRate}
                    onChange={(e) => setForm({ ...form, referrerRate: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>决策/成交人</Label>
                  <Input
                    value={form.closer}
                    onChange={(e) => setForm({ ...form, closer: e.target.value })}
                    placeholder="谁谈成的"
                  />
                </div>

                <div className="space-y-2">
                  <Label>佣金(%)</Label>
                  <Input
                    type="number"
                    value={form.closerRate}
                    onChange={(e) => setForm({ ...form, closerRate: Number(e.target.value) })}
                  />
                </div>
              </div>

              {form.memberType !== "Normal" && (
                <p className="text-xs text-yellow-700">⚠️ 团队成员：佣金全额立即发放，无对赌风险</p>
              )}
            </div>

            <Button type="submit" className="w-full" size="lg">
              确认录入
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Right: Course Package Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-lg">课程包详细配置</CardTitle>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 p-4 bg-gray-50/50 rounded-lg border">
            <div className="text-center">
              <div className="text-sm font-medium text-gray-600 mb-1">大班课</div>
              <div className="text-lg font-bold text-blue-600">{courseSummary.largeClassHours}h</div>
              <div className="text-sm font-medium text-blue-600">
                ¥{courseSummary.largeClassRevenue.toLocaleString()}
              </div>
            </div>
            <div className="text-center border-x">
              <div className="text-sm font-medium text-gray-600 mb-1">答疑课</div>
              <div className="text-lg font-bold text-orange-600">{courseSummary.otherHours}h</div>
              <div className="text-sm font-medium text-orange-600">¥{courseSummary.otherRevenue.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-medium text-gray-600 mb-1">总计</div>
              <div className="text-lg font-bold text-green-600">{courseSummary.totalHours}h</div>
              <div className="text-sm font-bold text-green-600">¥{courseSummary.totalRevenue.toLocaleString()}</div>
            </div>
          </div>

          {/* Course List */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {form.selectedCourses.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-gray-50/50 rounded-lg border-2 border-dashed">
                <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="font-medium">暂无课程</p>
                <p className="text-sm mt-1">请先选择年级、专业、学期</p>
                <p className="text-sm">系统将自动加载对应课程包</p>
              </div>
            ) : (
              form.selectedCourses.map((course, index) => (
                <div key={index} className="border rounded-lg p-4 bg-white hover:shadow-sm transition-shadow">
                  {/* Course header */}
                  <div className="flex items-start gap-3 mb-3">
                    <Checkbox
                      checked={course.selected}
                      onCheckedChange={(checked) => {
                        const newCourses = [...form.selectedCourses]
                        newCourses[index].selected = !!checked
                        setForm({ ...form, selectedCourses: newCourses })
                      }}
                      className="mt-0.5"
                    />
                    <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
                      <span className="font-medium text-gray-900 truncate flex-shrink">{course.name}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-lg font-bold text-blue-600 whitespace-nowrap">
                          ¥{(course.editHours * course.editRate).toLocaleString()}
                        </span>
                        <Badge
                          variant={course.type === "大班课" ? "default" : "secondary"}
                          className={course.type === "大班课" ? "bg-blue-500" : "bg-orange-500"}
                        >
                          {course.type}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Course details */}
                  <div className="pl-8 space-y-3">
                    {/* Student fee */}
                    <div className="flex items-center gap-3">
                      <Label className="text-sm font-medium text-blue-600 w-20">学员收费</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={course.editHours}
                          onChange={(e) => {
                            const newCourses = [...form.selectedCourses]
                            newCourses[index].editHours = Number(e.target.value)
                            setForm({ ...form, selectedCourses: newCourses })
                          }}
                          className="h-9 w-16 text-center"
                        />
                        <span className="text-sm text-gray-400 whitespace-nowrap">课时 ×</span>
                        <Input
                          type="number"
                          value={course.editRate}
                          onChange={(e) => {
                            const newCourses = [...form.selectedCourses]
                            newCourses[index].editRate = Number(e.target.value)
                            setForm({ ...form, selectedCourses: newCourses })
                          }}
                          className="h-9 w-24 text-center"
                        />
                        <span className="text-sm text-gray-400 w-10">元/h</span>
                      </div>
                    </div>

                    {/* Teacher compensation */}
                    <div className="flex items-center gap-3">
                      <Label className="text-sm font-medium text-purple-600 w-20 whitespace-nowrap">老师课酬</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          value={course.assignedTeacher}
                          onChange={(e) => {
                            const newCourses = [...form.selectedCourses]
                            newCourses[index].assignedTeacher = e.target.value
                            setForm({ ...form, selectedCourses: newCourses })
                          }}
                          className="h-9 w-20"
                          placeholder="待定"
                        />
                        <Select
                          value={`T${course.assignedTierIndex + 1}`}
                          onValueChange={(value) => {
                            const newCourses = [...form.selectedCourses]
                            newCourses[index].assignedTierIndex = Number.parseInt(value.replace("T", "")) - 1
                            setForm({ ...form, selectedCourses: newCourses })
                          }}
                        >
                          <SelectTrigger className="h-9 w-16">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["T5", "T4", "T3", "T2", "T1"].map((tier) => (
                              <SelectItem key={tier} value={tier}>
                                {tier}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          value={course.assignedCost}
                          onChange={(e) => {
                            const newCourses = [...form.selectedCourses]
                            newCourses[index].assignedCost = Number(e.target.value)
                            setForm({ ...form, selectedCourses: newCourses })
                          }}
                          className="h-9 w-24 text-center"
                          placeholder="600"
                        />
                        <span className="text-sm text-gray-400 w-10">元/h</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Submit button */}
          {form.selectedCourses.length > 0 && (
            <Button
              onClick={handleSubmit}
              className="w-full h-11 text-base font-medium bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              <Save className="w-4 h-4 mr-2" />
              确认录入
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
