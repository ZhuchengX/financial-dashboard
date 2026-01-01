"use client"

import type React from "react"
import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Pencil, Trash2, AlertTriangle, Undo2, ArrowRightLeft, Minus, AlertCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { generateId } from "@/lib/id"
import type { Student, TeacherRecord, Teacher, Course } from "@/types"
import { ACCOUNT_TYPES, EXPENSE_STATUS, TEACHER_TIERS } from "@/lib/constants"

type Props = {
  students: Student[]
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>
  teacherRecords: TeacherRecord[]
  setTeacherRecords: React.Dispatch<React.SetStateAction<TeacherRecord[]>>
  teachers: Teacher[]
  markDirty: () => void
  notify: (message: string, type: "success" | "error" | "info") => void
  presetData: any
}

export function StudentLog({
  students,
  setStudents,
  teacherRecords,
  setTeacherRecords,
  teachers,
  markDirty,
  notify,
  presetData,
}: Props) {
  const [selectedStudentId, setSelectedStudentId] = useState("")
  const [selectedCourseId, setSelectedCourseId] = useState("")
  const [hoursToAdd, setHoursToAdd] = useState(0)
  const [classDate, setClassDate] = useState(new Date().toISOString().split("T")[0])
  const [activeTeacher, setActiveTeacher] = useState<{ name: string; cost: number }>({ name: "", cost: 0 })
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    teacherName: "",
    teacherBaseCost: "",
    totalHours: "",
    hourlyRate: "",
    attendedHours: "",
  })

  const [overtimeAlert, setOvertimeAlert] = useState<{
    show: boolean
    message: string
    freeHours: number
    lastLogId: string | null
  }>({
    show: false,
    message: "",
    freeHours: 0,
    lastLogId: null,
  })

  const [transferDialog, setTransferDialog] = useState({
    show: false,
    sourceCourseId: "",
    hours: 0,
    targetType: "existing" as "existing" | "new",
    targetCourseId: "",
    newCourse: {
      name: "",
      type: "大班课",
      teacherName: "",
      teacherBaseCost: 0,
      hourlyRate: 0,
      semester: "",
    },
  })

  const [reduceDialog, setReduceDialog] = useState({
    show: false,
    courseId: "",
    hours: 0,
  })

  const activeStudent = useMemo(() => students.find((s) => s.id === selectedStudentId), [students, selectedStudentId])

  const filteredCourses = useMemo(() => {
    if (!activeStudent) return []
    return activeStudent.courses.filter((c) => c.semester === activeStudent.semester)
  }, [activeStudent])

  const activeCourse = useMemo(
    () => filteredCourses.find((c) => c.id === selectedCourseId),
    [filteredCourses, selectedCourseId],
  )

  useEffect(() => {
    if (activeCourse) {
      const teacherName = activeCourse.teacherName || ""
      const teacher = teachers.find((t) => t.name === teacherName)

      // 从全局老师列表读取最新基准课酬
      let baseCost = activeCourse.teacherBaseCost || 0
      if (teacher) {
        baseCost = teacher.customBaseSalary
          ? Number.parseFloat(teacher.customBaseSalary)
          : TEACHER_TIERS[teacher.tierIndex].base
      }

      setActiveTeacher({
        name: teacherName,
        cost: baseCost,
      })
    } else {
      setActiveTeacher({ name: "", cost: 0 })
    }
  }, [activeCourse, teachers])

  useEffect(() => {
    if (activeTeacher.name) {
      const teacher = teachers.find((t) => t.name === activeTeacher.name)
      if (teacher) {
        const baseCost = teacher.customBaseSalary
          ? Number.parseFloat(teacher.customBaseSalary)
          : TEACHER_TIERS[teacher.tierIndex].base
        setActiveTeacher((prev) => ({
          ...prev,
          cost: baseCost,
        }))
      }
    }
  }, [activeTeacher.name, teachers])

  const handleLog = () => {
    if (!activeStudent || !activeCourse || hoursToAdd === 0) return

    const isGroupClass = activeCourse.type === "大班课" || activeCourse.name.includes("大班")
    let affectedCount = 0
    let newStudents = [...students]

    const currentTeacherName = activeTeacher.name || activeCourse.teacherName
    const currentCostBase = Number(activeTeacher.cost || activeCourse.teacherBaseCost)
    const tierIdx = activeCourse.teacherTierIndex !== undefined ? activeCourse.teacherTierIndex : 4

    const isCorrection = hoursToAdd < 0
    const logType = isCorrection ? "消课回退/修正" : isGroupClass ? "大班课批量消课" : "自动消课"

    const syncId = generateId()

    const roundedHours = Number.parseFloat(Number(hoursToAdd).toFixed(2))
    let actualChargeableHours = roundedHours
    let freeHours = 0

    if (isGroupClass && !isCorrection && presetData) {
      const presetCourse = presetData[activeStudent.major]?.[activeStudent.grade]?.[activeStudent.semester]?.find(
        (preset: any) => preset.name === activeCourse.name,
      )

      if (presetCourse) {
        const presetTotalHours = presetCourse.hours
        const newAttendedTotal = activeCourse.attendedHours + roundedHours

        if (newAttendedTotal > presetTotalHours) {
          const excess = newAttendedTotal - presetTotalHours
          if (activeCourse.attendedHours < presetTotalHours) {
            freeHours = excess
            actualChargeableHours = roundedHours - freeHours
          } else {
            freeHours = roundedHours
            actualChargeableHours = 0
          }
        }
      }
    }

    const totalCost = Number.parseFloat((currentCostBase * roundedHours).toFixed(2))

    const newTeacherRecord: TeacherRecord = {
      id: generateId(),
      syncId: syncId,
      teacherName: currentTeacherName,
      courseName: activeCourse.name,
      courseType: activeCourse.type || (activeCourse.name.includes("答疑") ? "答疑课" : "大班课"),
      projectTag: activeCourse.projectTag,
      gradSchool: "",
      majorRank: "",
      baseTierIndex: tierIdx,
      evalBonus: 0,
      scoreBonus: 0,
      baseHourlyCost: currentCostBase,
      performanceCost: 0,
      attendedHours: roundedHours,
      totalCost: totalCost,
      date: classDate,
      account: ACCOUNT_TYPES.PRIVATE,
      status: EXPENSE_STATUS.PRIVATE_PAID,
      handler: "系统自动",
      payee: currentTeacherName,
      infoUpdateTime: new Date().toISOString(),
      isAutoGenerated: true,
      abstract: logType,
    }

    if (isGroupClass) {
      const otherStudents = students.filter(
        (s) =>
          s.id !== selectedStudentId &&
          s.grade === activeStudent.grade &&
          s.major === activeStudent.major &&
          s.semester === activeStudent.semester,
      )

      newStudents = newStudents.map((s) => {
        const shouldUpdate =
          s.id === selectedStudentId ||
          otherStudents.some((other) => other.id === s.id && s.courses.some((c) => c.name === activeCourse.name))

        if (shouldUpdate) {
          affectedCount++
          return {
            ...s,
            courses: s.courses.map((c) =>
              c.name === activeCourse.name && c.semester === activeStudent.semester
                ? {
                    ...c,
                    attendedHours: Number.parseFloat((c.attendedHours + roundedHours).toFixed(2)),
                  }
                : c,
            ),
          }
        }
        return s
      })
    } else {
      newStudents = newStudents.map((s) =>
        s.id === selectedStudentId
          ? {
              ...s,
              courses: s.courses.map((c) =>
                c.id === selectedCourseId
                  ? {
                      ...c,
                      attendedHours: Number.parseFloat((c.attendedHours + roundedHours).toFixed(2)),
                    }
                  : c,
              ),
            }
          : s,
      )
      affectedCount = 1
    }

    setStudents(newStudents)
    setTeacherRecords([...teacherRecords, newTeacherRecord])
    markDirty()
    setHoursToAdd(0)

    if (freeHours > 0) {
      setOvertimeAlert({
        show: true,
        message: `本次消课 ${roundedHours}h 中，有 ${freeHours}h 超出课程配置包规定课时，已自动设为不收费。如需撤销，请点击撤销按钮。`,
        freeHours: freeHours,
        lastLogId: newTeacherRecord.id,
      })

      setTimeout(() => {
        setOvertimeAlert({ show: false, message: "", freeHours: 0, lastLogId: null })
      }, 10000)
    }

    if (isCorrection) {
      notify(`已回退 ${Math.abs(roundedHours)} 课时，并自动生成负值课酬记录 ¥${totalCost}。`, "success")
    } else {
      const chargeMessage = freeHours > 0 ? `（其中 ${actualChargeableHours}h 计费，${freeHours}h 不计费）` : ""
      notify(
        `批量消课成功！扣除 ${affectedCount} 人课时${chargeMessage}，自动生成 ${currentTeacherName} 课酬 ¥${totalCost}。`,
        freeHours > 0 ? "info" : "success",
      )
    }
  }

  const handleUndoLastLog = () => {
    if (!overtimeAlert.lastLogId || !activeStudent || !activeCourse) return

    const newTeacherRecords = teacherRecords.filter((tr) => tr.id !== overtimeAlert.lastLogId)

    const lastRecord = teacherRecords.find((tr) => tr.id === overtimeAlert.lastLogId)
    if (!lastRecord) return

    const hoursToRemove = lastRecord.attendedHours
    const isGroupClass = activeCourse.type === "大班课" || activeCourse.name.includes("大班")

    let newStudents = [...students]

    if (isGroupClass) {
      const otherStudents = students.filter(
        (s) =>
          s.id !== selectedStudentId &&
          s.grade === activeStudent.grade &&
          s.major === activeStudent.major &&
          s.semester === activeStudent.semester,
      )

      newStudents = newStudents.map((s) => {
        const shouldUpdate =
          s.id === selectedStudentId ||
          otherStudents.some((other) => other.id === s.id && s.courses.some((c) => c.name === activeCourse.name))

        if (shouldUpdate) {
          return {
            ...s,
            courses: s.courses.map((c) =>
              c.name === activeCourse.name && c.semester === activeStudent.semester
                ? {
                    ...c,
                    attendedHours: Number.parseFloat((c.attendedHours - hoursToRemove).toFixed(2)),
                  }
                : c,
            ),
          }
        }
        return s
      })
    } else {
      newStudents = newStudents.map((s) =>
        s.id === selectedStudentId
          ? {
              ...s,
              courses: s.courses.map((c) =>
                c.id === selectedCourseId
                  ? {
                      ...c,
                      attendedHours: Number.parseFloat((c.attendedHours - hoursToRemove).toFixed(2)),
                    }
                  : c,
              ),
            }
          : s,
      )
    }

    setStudents(newStudents)
    setTeacherRecords(newTeacherRecords)
    markDirty()
    setOvertimeAlert({ show: false, message: "", freeHours: 0, lastLogId: null })
    notify("已撤销上次消课操作", "success")
  }

  const handleEdit = () => {
    if (!activeCourse) return
    setEditForm({
      teacherName: activeCourse.teacherName,
      teacherBaseCost: activeCourse.teacherBaseCost,
      totalHours: activeCourse.totalHours,
      hourlyRate: activeCourse.hourlyRate,
      attendedHours: activeCourse.attendedHours,
    })
    setIsEditing(true)
  }

  const handleSaveEdit = () => {
    const newStudents = students.map((s) => {
      if (s.id === selectedStudentId) {
        return {
          ...s,
          courses: s.courses.map((c) =>
            c.id === selectedCourseId
              ? {
                  ...c,
                  teacherName: editForm.teacherName,
                  teacherBaseCost: Number(editForm.teacherBaseCost),
                  totalHours: Number(editForm.totalHours),
                  hourlyRate: Number(editForm.hourlyRate),
                  totalCost: Number(editForm.totalHours) * Number(editForm.hourlyRate),
                  attendedHours: Number(editForm.attendedHours),
                }
              : c,
          ),
        }
      }
      return s
    })
    setStudents(newStudents)
    markDirty()
    setIsEditing(false)
    notify("课程已更新！", "success")
  }

  const handleDeleteCourse = () => {
    if (!window.confirm(`危险操作：确定要删除课程【${activeCourse?.name}】吗？此操作无法撤销！`)) return

    const newStudents = students.map((s) => {
      if (s.id === selectedStudentId) return { ...s, courses: s.courses.filter((c) => c.id !== selectedCourseId) }
      return s
    })

    setStudents(newStudents)
    markDirty()
    setSelectedCourseId("")
    notify("课程已删除！数据将自动保存", "success")
  }

  const handleTransferHours = () => {
    if (!activeStudent) return

    const sourceCourse = activeStudent.courses.find((c) => c.id === transferDialog.sourceCourseId)
    if (!sourceCourse) {
      notify("源课程未找到", "error")
      return
    }

    const remainingHours = sourceCourse.totalHours - sourceCourse.attendedHours
    if (transferDialog.hours <= 0 || transferDialog.hours > remainingHours) {
      notify(`转移课时必须大于0且不超过剩余课时 ${remainingHours.toFixed(2)}`, "error")
      return
    }

    const updatedStudents = students.map((student) => {
      if (student.id !== activeStudent.id) return student

      const updatedCourses = [...student.courses]

      if (transferDialog.targetType === "existing") {
        // Transfer to existing course
        const targetIndex = updatedCourses.findIndex((c) => c.id === transferDialog.targetCourseId)
        const sourceIndex = updatedCourses.findIndex((c) => c.id === transferDialog.sourceCourseId)

        if (targetIndex === -1 || sourceIndex === -1) {
          notify("目标课程或源课程未找到", "error")
          return student
        }

        // Decrease source course total hours and total cost
        updatedCourses[sourceIndex] = {
          ...updatedCourses[sourceIndex],
          totalHours: updatedCourses[sourceIndex].totalHours - transferDialog.hours,
          totalCost:
            updatedCourses[sourceIndex].totalCost - transferDialog.hours * updatedCourses[sourceIndex].hourlyRate,
        }

        // Increase target course total hours and total cost
        updatedCourses[targetIndex] = {
          ...updatedCourses[targetIndex],
          totalHours: updatedCourses[targetIndex].totalHours + transferDialog.hours,
          totalCost:
            updatedCourses[targetIndex].totalCost + transferDialog.hours * updatedCourses[targetIndex].hourlyRate,
        }
      } else {
        // Transfer to new course
        const sourceIndex = updatedCourses.findIndex((c) => c.id === transferDialog.sourceCourseId)
        if (sourceIndex === -1) {
          notify("源课程未找到", "error")
          return student
        }

        // Decrease source course
        updatedCourses[sourceIndex] = {
          ...updatedCourses[sourceIndex],
          totalHours: updatedCourses[sourceIndex].totalHours - transferDialog.hours,
          totalCost:
            updatedCourses[sourceIndex].totalCost - transferDialog.hours * updatedCourses[sourceIndex].hourlyRate,
        }

        // Create new course with transferred hours
        const newCourse: Course = {
          id: generateId(),
          name: transferDialog.newCourse.name,
          type: transferDialog.newCourse.type,
          semester: transferDialog.newCourse.semester || student.semester,
          totalHours: transferDialog.hours,
          attendedHours: 0,
          hourlyRate: transferDialog.newCourse.hourlyRate,
          totalCost: transferDialog.hours * transferDialog.newCourse.hourlyRate,
          isPaid: false,
          teacherName: transferDialog.newCourse.teacherName,
          teacherTierIndex: 0,
          teacherBaseCost: transferDialog.newCourse.teacherBaseCost,
          projectTag: updatedCourses[sourceIndex].projectTag,
        }

        updatedCourses.push(newCourse)
      }

      return {
        ...student,
        courses: updatedCourses,
      }
    })

    setStudents(updatedStudents)
    markDirty()

    const targetName =
      transferDialog.targetType === "existing"
        ? activeStudent.courses.find((c) => c.id === transferDialog.targetCourseId)?.name
        : transferDialog.newCourse.name

    notify(`成功将 ${transferDialog.hours.toFixed(2)} 课时从 ${sourceCourse.name} 转移到 ${targetName}`, "success")

    // Reset dialog
    setTransferDialog({
      show: false,
      sourceCourseId: "",
      hours: 0,
      targetType: "existing",
      targetCourseId: "",
      newCourse: {
        name: "",
        type: "大班课",
        teacherName: "",
        teacherBaseCost: 0,
        hourlyRate: 0,
        semester: "",
      },
    })
  }

  const handleReduceHours = () => {
    if (!activeStudent || !reduceDialog.courseId || reduceDialog.hours <= 0) {
      notify("请输入要减少的课时数", "warning")
      return
    }

    console.log("[v0] Starting handleReduceHours:", {
      studentId: activeStudent.id,
      courseId: reduceDialog.courseId,
      hoursToReduce: reduceDialog.hours,
    })

    const course = activeStudent.courses.find((c) => c.id === reduceDialog.courseId)
    if (!course) {
      notify("课程不存在", "error")
      return
    }

    if (reduceDialog.hours > course.attendedHours) {
      notify(`减少课时不能超过已消课时 (${course.attendedHours.toFixed(2)} 课时)`, "error")
      return
    }

    // Find matching teacher records for this course
    const matchingRecords = teacherRecords
      .filter(
        (tr) => tr.courseName === course.name && tr.courseType === course.type && tr.attendedHours > 0, // Only positive hours
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Sort by date, newest first

    console.log("[v0] Found matching records:", matchingRecords.length)

    if (matchingRecords.length === 0) {
      // If no matching records are found, still allow reducing the student's attended hours (for data correction)
      const newStudents = students.map((s) => {
        if (s.id === selectedStudentId) {
          return {
            ...s,
            courses: s.courses.map((c) =>
              c.id === reduceDialog.courseId
                ? {
                    ...c,
                    attendedHours: Math.max(0, c.attendedHours - reduceDialog.hours),
                  }
                : c,
            ),
          }
        }
        return s
      })

      setStudents(newStudents)
      markDirty()
      setReduceDialog({ show: false, courseId: "", hours: 0 })
      notify(`已减少 ${reduceDialog.hours.toFixed(2)} 课时（仅更新学员数据）`, "success")
      return
    }

    let remainingToReduce = reduceDialog.hours
    const recordsToDelete: string[] = []
    const recordsToModify: { id: string; newHours: number }[] = []

    // Support partial reduction of teacher records' hours
    for (const record of matchingRecords) {
      if (remainingToReduce <= 0) break

      if (record.attendedHours <= remainingToReduce) {
        // Delete this entire record
        recordsToDelete.push(record.id)
        remainingToReduce -= record.attendedHours
      } else {
        // Partially reduce this record
        recordsToModify.push({
          id: record.id,
          newHours: record.attendedHours - remainingToReduce,
        })
        remainingToReduce = 0
      }
    }

    console.log("[v0] Records to delete:", recordsToDelete.length)
    console.log("[v0] Records to modify:", recordsToModify.length)

    // Update teacher records
    const newTeacherRecords = teacherRecords
      .filter((tr) => !recordsToDelete.includes(tr.id))
      .map((tr) => {
        const modify = recordsToModify.find((m) => m.id === tr.id)
        if (modify) {
          return {
            ...tr,
            attendedHours: modify.newHours,
            totalCost: modify.newHours * tr.baseHourlyCost,
          }
        }
        return tr
      })

    // Update student's attended hours
    const newStudents = students.map((s) => {
      if (s.id === selectedStudentId) {
        return {
          ...s,
          courses: s.courses.map((c) =>
            c.id === reduceDialog.courseId
              ? {
                  ...c,
                  attendedHours: Math.max(0, c.attendedHours - reduceDialog.hours),
                }
              : c,
          ),
        }
      }
      return s
    })

    setStudents(newStudents)
    setTeacherRecords(newTeacherRecords)
    markDirty()
    setReduceDialog({ show: false, courseId: "", hours: 0 })
    notify(
      `已减少 ${reduceDialog.hours.toFixed(2)} 课时，删除了 ${recordsToDelete.length} 条授课记录，修改了 ${recordsToModify.length} 条授课记录`,
      "success",
    )
  }

  return (
    <div className="space-y-6">
      {overtimeAlert.show && (
        <Card className="border-orange-500 bg-orange-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-900">{overtimeAlert.message}</p>
              </div>
              <Button
                onClick={handleUndoLastLog}
                size="sm"
                variant="outline"
                className="border-orange-600 text-orange-600 hover:bg-orange-100 bg-transparent"
              >
                <Undo2 className="w-4 h-4 mr-1" />
                撤销
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>学员课程进度</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-2">
              <Label>1. 选择学生</Label>
              <Select
                value={selectedStudentId}
                onValueChange={(value) => {
                  setSelectedStudentId(value)
                  setSelectedCourseId("")
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择学生" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} - {s.grade} ({s.major})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {activeStudent && (
              <>
                <div className="space-y-2">
                  <Label>2. 选择课程</Label>
                  <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择课程" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCourses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.type}) - {c.attendedHours.toFixed(2)}/{c.totalHours.toFixed(2)}课时
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {activeCourse && (
              <>
                <div className="space-y-2">
                  <Label>消课课时</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={hoursToAdd}
                    onChange={(e) => setHoursToAdd(Number(e.target.value))}
                    placeholder="如1.00、0.66"
                  />
                </div>

                <div className="space-y-2">
                  <Label>上课日期</Label>
                  <Input type="date" value={classDate} onChange={(e) => setClassDate(e.target.value)} />
                </div>
              </>
            )}
          </div>

          {activeCourse && (
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>授课老师（本次）</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Input
                        placeholder="老师姓名"
                        value={activeTeacher.name}
                        onChange={(e) => setActiveTeacher({ ...activeTeacher, name: e.target.value })}
                        list="teacher-list"
                      />
                      <datalist id="teacher-list">
                        {teachers.map((teacher) => (
                          <option key={teacher.id} value={teacher.name} />
                        ))}
                      </datalist>
                    </div>
                    <Input
                      type="number"
                      placeholder="课酬"
                      value={activeTeacher.cost || ""}
                      onChange={(e) => setActiveTeacher({ ...activeTeacher, cost: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="flex items-end gap-2">
                  <Button onClick={handleLog} className="flex-1" disabled={hoursToAdd === 0}>
                    确认消课
                  </Button>
                  <Button onClick={handleEdit} variant="outline" size="icon">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button onClick={handleDeleteCourse} variant="destructive" size="icon">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {activeStudent && (
        <>
          <div className="mb-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!selectedCourseId) {
                  notify("请先选择要转移课时的课程", "warning")
                  return
                }
                setTransferDialog({
                  ...transferDialog,
                  show: true,
                  sourceCourseId: selectedCourseId,
                  hours: 0,
                })
              }}
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              转移课时
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!selectedCourseId) {
                  notify("请先选择要减少课时的课程", "warning")
                  return
                }
                setReduceDialog({
                  show: true,
                  courseId: selectedCourseId,
                  hours: 0,
                })
              }}
            >
              <Minus className="mr-2 h-4 w-4" />
              减少已消课时
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredCourses.map((course) => {
              const pct = Math.min(100, Math.round((course.attendedHours / course.totalHours) * 100)) || 0
              const isFinished = course.attendedHours >= course.totalHours
              const consumedValue = course.attendedHours * course.hourlyRate

              const isGroupClass = course.type === "大班课"
              const borderColor = isFinished
                ? "border-gray-300"
                : isGroupClass
                  ? "border-blue-400"
                  : "border-orange-400"
              const ringColor = isGroupClass ? "ring-blue-500" : "ring-orange-500"
              const textColor = isGroupClass ? "text-blue-600" : "text-orange-600"

              return (
                <div
                  key={course.id}
                  className={`p-3 rounded border-2 cursor-pointer transition-all ${
                    isFinished ? "bg-gray-100 border-gray-300 opacity-70" : `bg-white ${borderColor}`
                  } ${selectedCourseId === course.id ? `ring-2 ${ringColor}` : ""}`}
                  onClick={() => setSelectedCourseId(course.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-sm">{course.name}</div>
                      <div className="flex gap-1 text-xs text-gray-500 mt-1">
                        <span>{course.teacherName}</span>
                        <Badge
                          variant="secondary"
                          className={`text-xs ${!isFinished && (isGroupClass ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700")}`}
                        >
                          {course.type}
                        </Badge>
                      </div>
                    </div>
                    <Badge variant={isFinished ? "secondary" : "default"}>{isFinished ? "已结课" : `${pct}%`}</Badge>
                  </div>

                  <div className="bg-gray-50 rounded p-2 mb-2 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">总计签约:</span>
                      <span className="font-bold">
                        {course.totalHours.toFixed(2)}课时 / ¥{course.totalCost.toLocaleString()}
                      </span>
                    </div>
                    <div className={`flex justify-between ${!isFinished && textColor}`}>
                      <span>累计已消:</span>
                      <span className="font-bold">
                        {course.attendedHours.toFixed(2)}课时 / ¥{consumedValue.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <Progress value={pct} className="h-2" />
                  <div className="text-xs text-right text-gray-400 mt-1">{course.semester}</div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <Dialog open={transferDialog.show} onOpenChange={(open) => setTransferDialog({ ...transferDialog, show: open })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>课时转移</DialogTitle>
            <DialogDescription>将课程的剩余课时转移到其他课程，源课程总课时减少，目标课程总课时增加</DialogDescription>
          </DialogHeader>

          {transferDialog.sourceCourseId && (
            <div className="space-y-4">
              {(() => {
                const sourceCourse = activeStudent?.courses.find((c) => c.id === transferDialog.sourceCourseId)
                const remainingHours = sourceCourse ? sourceCourse.totalHours - sourceCourse.attendedHours : 0

                return (
                  <>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">源课程</div>
                      <div className="font-semibold">{sourceCourse?.name}</div>
                      <div className="text-sm text-gray-500 mt-1">剩余课时: {remainingHours.toFixed(2)} 课时</div>
                    </div>

                    <div className="space-y-2">
                      <Label>转移课时数</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={remainingHours}
                        value={transferDialog.hours}
                        onChange={(e) => setTransferDialog({ ...transferDialog, hours: Number(e.target.value) })}
                        placeholder={`最多可转移 ${remainingHours.toFixed(2)} 课时`}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>转移目标</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={transferDialog.targetType === "existing" ? "default" : "outline"}
                          onClick={() => setTransferDialog({ ...transferDialog, targetType: "existing" })}
                          className="flex-1"
                        >
                          转移到已有课程
                        </Button>
                        <Button
                          variant={transferDialog.targetType === "new" ? "default" : "outline"}
                          onClick={() => setTransferDialog({ ...transferDialog, targetType: "new" })}
                          className="flex-1"
                        >
                          创建新课程
                        </Button>
                      </div>
                    </div>

                    {transferDialog.targetType === "existing" ? (
                      <div className="space-y-2">
                        <Label>目标课程</Label>
                        <Select
                          value={transferDialog.targetCourseId}
                          onValueChange={(value) => setTransferDialog({ ...transferDialog, targetCourseId: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择目标课程" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeStudent?.courses
                              .filter((c) => c.id !== transferDialog.sourceCourseId)
                              .map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name} ({c.type}) - {c.attendedHours.toFixed(2)}/{c.totalHours.toFixed(2)}课时
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-3 border-t pt-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>课程名称 *</Label>
                            <Input
                              value={transferDialog.newCourse.name}
                              onChange={(e) =>
                                setTransferDialog({
                                  ...transferDialog,
                                  newCourse: { ...transferDialog.newCourse, name: e.target.value },
                                })
                              }
                              placeholder="输入新课程名称"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>课程类型 *</Label>
                            <Select
                              value={transferDialog.newCourse.type}
                              onValueChange={(value) =>
                                setTransferDialog({
                                  ...transferDialog,
                                  newCourse: { ...transferDialog.newCourse, type: value },
                                })
                              }
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
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>授课老师</Label>
                            <Input
                              value={transferDialog.newCourse.teacherName}
                              onChange={(e) =>
                                setTransferDialog({
                                  ...transferDialog,
                                  newCourse: { ...transferDialog.newCourse, teacherName: e.target.value },
                                })
                              }
                              placeholder="老师姓名"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>老师课酬(元/课时)</Label>
                            <Input
                              type="number"
                              value={transferDialog.newCourse.teacherBaseCost}
                              onChange={(e) =>
                                setTransferDialog({
                                  ...transferDialog,
                                  newCourse: {
                                    ...transferDialog.newCourse,
                                    teacherBaseCost: Number(e.target.value),
                                  },
                                })
                              }
                              placeholder="课酬"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>学员课时费(元/课时) *</Label>
                            <Input
                              type="number"
                              value={transferDialog.newCourse.hourlyRate}
                              onChange={(e) =>
                                setTransferDialog({
                                  ...transferDialog,
                                  newCourse: { ...transferDialog.newCourse, hourlyRate: Number(e.target.value) },
                                })
                              }
                              placeholder="课时费"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>学期</Label>
                            <Input
                              value={transferDialog.newCourse.semester}
                              onChange={(e) =>
                                setTransferDialog({
                                  ...transferDialog,
                                  newCourse: { ...transferDialog.newCourse, semester: e.target.value },
                                })
                              }
                              placeholder={`默认: ${activeStudent?.semester}`}
                            />
                          </div>
                        </div>

                        <div className="bg-gray-50 p-3 rounded">
                          <div className="text-sm text-gray-600">预计总费用</div>
                          <div className="text-lg font-semibold">
                            ¥{(transferDialog.hours * transferDialog.newCourse.hourlyRate).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setTransferDialog({
                  show: false,
                  sourceCourseId: "",
                  hours: 0,
                  targetType: "existing",
                  targetCourseId: "",
                  newCourse: {
                    name: "",
                    type: "大班课",
                    teacherName: "",
                    teacherBaseCost: 0,
                    hourlyRate: 0,
                    semester: "",
                  },
                })
              }
            >
              取消
            </Button>
            <Button onClick={handleTransferHours}>确认转移</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reduceDialog.show} onOpenChange={(open) => setReduceDialog({ ...reduceDialog, show: open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>减少已消课时</DialogTitle>
            <DialogDescription>纠正误操作，减少课程的累计已消课时。减少后，剩余课时会相应增加。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {activeStudent &&
              reduceDialog.courseId &&
              (() => {
                const course = activeStudent.courses.find((c) => c.id === reduceDialog.courseId)
                return course ? (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded p-3 space-y-2">
                      <div className="font-semibold text-sm">
                        {course.name} ({course.type})
                      </div>
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-600">总计签约:</span>
                          <span className="font-semibold">{course.totalHours.toFixed(2)} 课时</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">累计已消:</span>
                          <span className="font-semibold text-blue-600">{course.attendedHours.toFixed(2)} 课时</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">剩余课时:</span>
                          <span className="font-semibold">
                            {(course.totalHours - course.attendedHours).toFixed(2)} 课时
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>要减少的课时数 *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={course.attendedHours}
                        value={reduceDialog.hours || ""}
                        onChange={(e) => setReduceDialog({ ...reduceDialog, hours: Number(e.target.value) })}
                        placeholder="输入要减少的课时"
                      />
                      <p className="text-xs text-gray-500">最多可减少 {course.attendedHours.toFixed(2)} 课时</p>
                    </div>

                    {reduceDialog.hours > 0 && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          减少后，累计已消课时将变为{" "}
                          <strong>{(course.attendedHours - reduceDialog.hours).toFixed(2)}</strong> 课时， 剩余课时变为{" "}
                          <strong>{(course.totalHours - course.attendedHours + reduceDialog.hours).toFixed(2)}</strong>{" "}
                          课时。
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                ) : null
              })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReduceDialog({ show: false, courseId: "", hours: 0 })}>
              取消
            </Button>
            <Button onClick={handleReduceHours} disabled={reduceDialog.hours <= 0}>
              确认减少
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
