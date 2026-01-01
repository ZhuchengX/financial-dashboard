"use client"

import { useState, useMemo, useEffect } from "react"
import { Save, Trash2, Edit3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import type { Student, Teacher, TeacherRecord } from "@/types"
import { TEACHER_TIERS, SCHOOL_LIST, ACCOUNT_TYPES, EXPENSE_STATUS, SEMESTER_ORDER_LIST } from "@/lib/constants"
import { generateId } from "@/lib/utils/helpers"

type TeacherCostLogProps = {
  students: Student[]
  teachers: Teacher[]
  teacherRecords: TeacherRecord[]
  setTeacherRecords: (records: TeacherRecord[]) => void
  markDirty: () => void
  notify: (message: string, type: "success" | "error" | "info") => void
}

export function TeacherCostLog({
  students,
  teachers,
  teacherRecords,
  setTeacherRecords,
  markDirty,
  notify,
}: TeacherCostLogProps) {
  const [form, setForm] = useState({
    teacherName: "",
    courseName: "",
    projectTag: "",
    gradSchool: "",
    majorRank: "",
    baseTierIndex: 5,
    attendedHours: 0,
    account: ACCOUNT_TYPES.PRIVATE,
    status: EXPENSE_STATUS.PRIVATE_PAID,
    handler: "",
    infoUpdateTime: "",
  })

  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState("")

  // Get unique teachings from students
  const uniqueTeachings = useMemo(() => {
    const list: Array<{ key: string; semester: string; teacherName: string; courseName: string; projectTag: string }> =
      []
    const seen = new Set<string>()

    students.forEach((s) => {
      s.courses.forEach((c) => {
        const key = `${c.semester}-${c.teacherName}-${c.name}`
        if (!seen.has(key)) {
          seen.add(key)
          list.push({
            key,
            semester: c.semester,
            teacherName: c.teacherName,
            courseName: c.name,
            projectTag: c.projectTag,
          })
        }
      })
    })

    return list.sort((a, b) => {
      const s1 = SEMESTER_ORDER_LIST.indexOf(a.semester)
      const s2 = SEMESTER_ORDER_LIST.indexOf(b.semester)
      if (s1 !== s2) return s1 - s2
      if (a.teacherName !== b.teacherName) return a.teacherName.localeCompare(b.teacherName)
      return a.courseName.localeCompare(b.courseName)
    })
  }, [students])

  // Auto-fill from teachers DB
  useEffect(() => {
    if (form.teacherName && teachers) {
      const dbTeacher = teachers.find((t) => t.name === form.teacherName)
      if (dbTeacher) {
        setForm((prev) => ({
          ...prev,
          gradSchool: dbTeacher.gradSchool || "",
          majorRank: dbTeacher.rankPos && dbTeacher.rankTotal ? `${dbTeacher.rankPos}/${dbTeacher.rankTotal}` : "",
          baseTierIndex: dbTeacher.tierIndex,
        }))
      }
    }
  }, [form.teacherName, teachers])

  // Auto-calculate tier from grad school and rank
  useEffect(() => {
    if (!form.gradSchool && !form.majorRank) return

    let schoolTier = 5
    let rankTier = 5

    const selectedSchool = SCHOOL_LIST.find((s) => s.name === form.gradSchool)
    if (selectedSchool) schoolTier = selectedSchool.tier

    const parts = form.majorRank.split("/")
    let rank = Number.parseFloat(form.majorRank)
    if (parts.length === 2) {
      rank = (Number.parseFloat(parts[0]) / Number.parseFloat(parts[1])) * 100
    }

    if (!isNaN(rank)) {
      if (rank <= 5) rankTier = 1
      else if (rank <= 10) rankTier = 2
      else if (rank <= 15) rankTier = 3
      else if (rank <= 20) rankTier = 4
    }

    const finalTier = Math.min(schoolTier, rankTier)
    const validTier = Math.min(Math.max(0, finalTier), TEACHER_TIERS.length - 1)

    if (validTier !== form.baseTierIndex) {
      setForm((prev) => ({ ...prev, baseTierIndex: validTier }))
    }
  }, [form.gradSchool, form.majorRank, form.baseTierIndex])

  const handleSelectTeaching = (key: string) => {
    const item = uniqueTeachings.find((x) => x.key === key)
    if (item) {
      setForm((prev) => ({
        ...prev,
        teacherName: item.teacherName,
        courseName: item.courseName,
        projectTag: item.projectTag || "",
        infoUpdateTime: "本次新增",
      }))
    }
  }

  const handleAdd = () => {
    if (!form.teacherName || !form.attendedHours) {
      notify("请填写完整", "error")
      return
    }

    const currentBase = TEACHER_TIERS[form.baseTierIndex].base
    const totalHourly = currentBase
    const newRecord: TeacherRecord = {
      id: generateId(),
      teacherName: form.teacherName,
      courseName: form.courseName,
      projectTag: form.projectTag,
      gradSchool: form.gradSchool,
      majorRank: form.majorRank,
      baseTierIndex: form.baseTierIndex,
      evalBonus: 0,
      scoreBonus: 0,
      baseHourlyCost: currentBase,
      performanceCost: 0,
      attendedHours: Number(form.attendedHours),
      totalCost: totalHourly * Number(form.attendedHours),
      date: new Date().toISOString().split("T")[0],
      account: form.account,
      status: form.status,
      handler: form.handler,
      payee: form.teacherName,
      infoUpdateTime: new Date().toISOString().split("T")[0],
    }

    setTeacherRecords([...teacherRecords, newRecord])
    markDirty()
    setForm({ ...form, attendedHours: 0 })
    notify("成本录入成功", "success")
  }

  const toggleStatus = (record: TeacherRecord) => {
    const newStatus =
      record.status === EXPENSE_STATUS.PRIVATE_PAID ? EXPENSE_STATUS.PUBLIC_PAID : EXPENSE_STATUS.PRIVATE_PAID
    const newAccount = newStatus === EXPENSE_STATUS.PUBLIC_PAID ? ACCOUNT_TYPES.PUBLIC : ACCOUNT_TYPES.PRIVATE
    const updatedRecords = teacherRecords.map((r) =>
      r.id === record.id ? { ...r, status: newStatus, account: newAccount } : r,
    )
    setTeacherRecords(updatedRecords)
    markDirty()
    notify(`状态更新为：${newStatus}`, "success")
  }

  const handleUpdateRecord = (id: string) => {
    const updatedRecords = teacherRecords.map((r) => (r.id === id ? { ...r, date: editDate } : r))
    setTeacherRecords(updatedRecords)
    markDirty()
    setEditingRecordId(null)
    notify("日期已更新", "success")
  }

  const startEditing = (record: TeacherRecord) => {
    setEditingRecordId(record.id)
    setEditDate(record.date)
  }

  const handleDelete = (id: string) => {
    if (window.confirm("确定要删除这条记录吗？删除后无法恢复。")) {
      setTeacherRecords(teacherRecords.filter((r) => r.id !== id))
      markDirty()
      notify("记录已删除", "success")
    }
  }

  const tierIndex = Math.min(Math.max(0, form.baseTierIndex), TEACHER_TIERS.length - 1)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>课时成本录入</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick select */}
          <div className="space-y-2">
            <Label>快速选择课程 (学期-老师-课程)</Label>
            <Select onValueChange={handleSelectTeaching}>
              <SelectTrigger>
                <SelectValue placeholder="选择课程" />
              </SelectTrigger>
              <SelectContent>
                {uniqueTeachings.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tier calculator */}
          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
            <h4 className="text-sm font-bold text-indigo-800 mb-3">教师定级计算器</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>保研去向</Label>
                <Select value={form.gradSchool} onValueChange={(value) => setForm({ ...form, gradSchool: value })}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="选择院校" />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHOOL_LIST.map((s) => (
                      <SelectItem key={s.name} value={s.name}>
                        {s.name} (T{s.tier + 1})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>排名 (%)</Label>
                <Input
                  placeholder="例: 5/100"
                  value={form.majorRank}
                  onChange={(e) => setForm({ ...form, majorRank: e.target.value })}
                  className="bg-white"
                />
              </div>
            </div>
          </div>

          {/* Main form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>老师姓名 (发给谁)</Label>
                <Input
                  list="dbTeachers"
                  value={form.teacherName}
                  onChange={(e) => setForm({ ...form, teacherName: e.target.value })}
                />
                <datalist id="dbTeachers">
                  {teachers.map((t) => (
                    <option key={t.id} value={t.name} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-2">
                <Label className="text-purple-700 font-bold">基础底薪</Label>
                <Select
                  value={String(tierIndex)}
                  onValueChange={(value) => setForm({ ...form, baseTierIndex: Number(value) })}
                >
                  <SelectTrigger className="border-purple-300 font-bold text-purple-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEACHER_TIERS.map((t, idx) => (
                      <SelectItem key={idx} value={String(idx)}>
                        {t.label} (¥{t.base})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-3 text-xs text-gray-500 bg-gray-50 rounded space-y-2">
              <p>日常仅需记录基础课时费，系统默认为"私下已付"。</p>
              <p>报销时，请在下方列表将状态改为"公账已结"。</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t">
            <div className="space-y-2">
              <Label>本次课时</Label>
              <Input
                type="number"
                value={form.attendedHours}
                onChange={(e) => setForm({ ...form, attendedHours: Number(e.target.value) })}
                className="bg-purple-50"
              />
            </div>

            <div className="space-y-2">
              <Label>经办人</Label>
              <Input value={form.handler} onChange={(e) => setForm({ ...form, handler: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>状态</Label>
              <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(EXPENSE_STATUS).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={handleAdd} className="w-full bg-purple-600 hover:bg-purple-700">
                录入成本
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Records table */}
      <Card>
        <CardHeader>
          <CardTitle>近期课时费流水 (点击状态可切换公/私)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className="p-2 text-left">日期</th>
                  <th className="p-2 text-left">老师</th>
                  <th className="p-2 text-left">课程/摘要</th>
                  <th className="p-2 text-right">金额</th>
                  <th className="p-2 text-left">经办人</th>
                  <th className="p-2 text-left">状态</th>
                  <th className="p-2 text-left">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {teacherRecords
                  .slice()
                  .reverse()
                  .slice(0, 20)
                  .map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="p-2">
                        {editingRecordId === r.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="date"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="h-7 w-28 text-xs"
                            />
                            <Button
                              onClick={() => handleUpdateRecord(r.id)}
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                            >
                              <Save className="w-3 h-3 text-green-600" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 group">
                            <span>{r.date}</span>
                            <Button
                              onClick={() => startEditing(r)}
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                            >
                              <Edit3 className="w-3 h-3 text-gray-400" />
                            </Button>
                          </div>
                        )}
                      </td>
                      <td className="p-2 font-medium">{r.teacherName}</td>
                      <td className="p-2 text-gray-500">{r.abstract || `${r.courseName} (${r.attendedHours}h)`}</td>
                      <td className="p-2 text-right font-bold">¥{r.totalCost.toLocaleString()}</td>
                      <td className="p-2">{r.handler || "-"}</td>
                      <td className="p-2">
                        <Badge
                          onClick={() => toggleStatus(r)}
                          className={`cursor-pointer ${
                            r.status === EXPENSE_STATUS.PUBLIC_PAID
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                          }`}
                        >
                          {r.status || "待处理"}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <Button onClick={() => handleDelete(r.id)} variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
