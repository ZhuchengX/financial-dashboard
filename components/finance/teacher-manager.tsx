"use client"

import { useState, useEffect, useMemo } from "react"
import { Users, Pencil, Trash2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import type { Teacher } from "@/types"
import { TEACHER_TIERS, SCHOOL_LIST } from "@/lib/constants"
import { generateId } from "@/lib/utils/helpers"

type TeacherManagerProps = {
  teachers: Teacher[]
  setTeachers: (teachers: Teacher[]) => void
  presetData: any
  setPresetData: (data: any) => void
  markDirty: () => void
  notify: (message: string, type: "success" | "error" | "info") => void
}

export function TeacherManager({
  teachers,
  setTeachers,
  presetData,
  setPresetData,
  markDirty,
  notify,
}: TeacherManagerProps) {
  const [form, setForm] = useState<Teacher>({
    id: "",
    name: "",
    gradSchool: "",
    rankPos: "",
    rankTotal: "",
    tierIndex: 5,
    customBaseSalary: "",
  })
  const [isEditing, setIsEditing] = useState(false)
  const [editingSalaryId, setEditingSalaryId] = useState<string | null>(null)
  const [editSalaryValue, setEditSalaryValue] = useState("")

  // Auto-calculate tier based on school and rank
  useEffect(() => {
    if (!form.gradSchool && !form.rankPos && !form.rankTotal) return

    let schoolTier = 5
    const schoolObj = SCHOOL_LIST.find((s) => s.name === form.gradSchool)
    if (schoolObj) schoolTier = schoolObj.tier

    let rankTier = 5
    const pos = Number.parseFloat(form.rankPos)
    const total = Number.parseFloat(form.rankTotal)
    if (pos && total) {
      const pct = (pos / total) * 100
      if (pct <= 5) rankTier = 1
      else if (pct <= 10) rankTier = 2
      else if (pct <= 15) rankTier = 3
      else if (pct <= 20) rankTier = 4
    }

    const finalTier = Math.min(schoolTier, rankTier)
    setForm((prev) => ({ ...prev, tierIndex: Math.min(Math.max(0, finalTier), 5) }))
  }, [form.gradSchool, form.rankPos, form.rankTotal])

  const handleSubmit = () => {
    if (!form.name || !form.gradSchool) {
      notify("请补全姓名和学校", "error")
      return
    }

    const newTeacher = { ...form, id: isEditing ? form.id : generateId() }

    if (isEditing) {
      const oldTeacher = teachers.find((t) => t.id === form.id)
      setTeachers(teachers.map((t) => (t.id === form.id ? newTeacher : t)))

      if (
        oldTeacher &&
        (oldTeacher.name !== newTeacher.name || oldTeacher.customBaseSalary !== newTeacher.customBaseSalary)
      ) {
        const updatedPresetData = { ...presetData }
        let coursesUpdated = 0

        Object.keys(updatedPresetData).forEach((major) => {
          Object.keys(updatedPresetData[major]).forEach((grade) => {
            Object.keys(updatedPresetData[major][grade]).forEach((semester) => {
              updatedPresetData[major][grade][semester] = updatedPresetData[major][grade][semester].map(
                (course: any) => {
                  if (course.defaultTeacher === oldTeacher.name) {
                    coursesUpdated++
                    return {
                      ...course,
                      defaultTeacher: newTeacher.name,
                      defaultCost: Number.parseFloat(newTeacher.customBaseSalary) || course.defaultCost,
                    }
                  }
                  return course
                },
              )
            })
          })
        })

        if (coursesUpdated > 0) {
          setPresetData(updatedPresetData)
          notify(`老师信息已更新，同步更新了 ${coursesUpdated} 门课程配置`, "success")
        } else {
          notify("老师信息已更新", "success")
        }
      } else {
        notify("老师信息已更新", "success")
      }
    } else {
      if (teachers.find((t) => t.name === form.name)) {
        notify("该老师已存在", "error")
        return
      }
      setTeachers([...teachers, newTeacher])
      notify("老师已录入库中", "success")
    }

    markDirty()
    setForm({
      id: "",
      name: "",
      gradSchool: "",
      rankPos: "",
      rankTotal: "",
      tierIndex: 5,
      customBaseSalary: "",
    })
    setIsEditing(false)
  }

  const handleEdit = (t: Teacher) => {
    setForm(t)
    setIsEditing(true)
  }

  const handleDelete = (id: string) => {
    if (window.confirm("确定删除该老师档案吗？")) {
      setTeachers(teachers.filter((t) => t.id !== id))
      markDirty()
      notify("老师已删除", "success")
    }
  }

  const handleUpdateSalary = (id: string) => {
    const teacher = teachers.find((t) => t.id === id)
    if (!teacher) return

    const updated = teachers.map((t) => (t.id === id ? { ...t, customBaseSalary: editSalaryValue } : t))
    setTeachers(updated)

    const updatedPresetData = { ...presetData }
    let coursesUpdated = 0

    Object.keys(updatedPresetData).forEach((major) => {
      Object.keys(updatedPresetData[major]).forEach((grade) => {
        Object.keys(updatedPresetData[major][grade]).forEach((semester) => {
          updatedPresetData[major][grade][semester] = updatedPresetData[major][grade][semester].map((course: any) => {
            if (course.defaultTeacher === teacher.name) {
              coursesUpdated++
              return {
                ...course,
                defaultCost: Number.parseFloat(editSalaryValue) || 0,
              }
            }
            return course
          })
        })
      })
    })

    if (coursesUpdated > 0) {
      setPresetData(updatedPresetData)
      notify(`基准课酬已更新，同步更新了 ${coursesUpdated} 门课程的课酬配置`, "success")
    } else {
      notify("基准课酬已更新", "success")
    }

    markDirty()
    setEditingSalaryId(null)
  }

  const startEditingSalary = (t: Teacher) => {
    setEditingSalaryId(t.id)
    setEditSalaryValue(t.customBaseSalary || String(TEACHER_TIERS[t.tierIndex].base))
  }

  const sortedTeachers = useMemo(() => {
    return [...teachers].sort((a, b) => a.tierIndex - b.tierIndex)
  }, [teachers])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            师资库录入
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="输入姓名"
              />
            </div>

            <div className="space-y-2">
              <Label>保研去向</Label>
              <Select value={form.gradSchool} onValueChange={(value) => setForm({ ...form, gradSchool: value })}>
                <SelectTrigger>
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
              <Label>专业排名</Label>
              <div className="flex gap-1 items-center">
                <Input
                  type="number"
                  placeholder="名次"
                  value={form.rankPos}
                  onChange={(e) => setForm({ ...form, rankPos: e.target.value })}
                />
                <span className="text-gray-400">/</span>
                <Input
                  type="number"
                  placeholder="总数"
                  value={form.rankTotal}
                  onChange={(e) => setForm({ ...form, rankTotal: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>系统定级</Label>
              <div className="px-3 py-2 bg-indigo-50 text-indigo-700 font-bold rounded border border-indigo-200">
                {TEACHER_TIERS[form.tierIndex].label}
              </div>
            </div>

            <div className="space-y-2">
              <Label>基准课酬 (元/h)</Label>
              <Input
                type="number"
                placeholder="自定义"
                value={form.customBaseSalary}
                onChange={(e) => setForm({ ...form, customBaseSalary: e.target.value })}
              />
            </div>

            <Button onClick={handleSubmit} className="bg-indigo-600 hover:bg-indigo-700">
              {isEditing ? "保存修改" : "添加老师"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>在库老师列表 ({teachers.length}人)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="p-3 text-left">姓名</th>
                  <th className="p-3 text-left">保研去向</th>
                  <th className="p-3 text-left">排名数据</th>
                  <th className="p-3 text-left">定级</th>
                  <th className="p-3 text-left">基准课酬</th>
                  <th className="p-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedTeachers.map((t) => {
                  const pct =
                    t.rankPos && t.rankTotal
                      ? ((Number.parseFloat(t.rankPos) / Number.parseFloat(t.rankTotal)) * 100).toFixed(1) + "%"
                      : "-"
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="p-3 font-bold">{t.name}</td>
                      <td className="p-3">{t.gradSchool}</td>
                      <td className="p-3 text-gray-600">
                        {t.rankPos}/{t.rankTotal}{" "}
                        <Badge variant="secondary" className="ml-1">
                          前{pct}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant="default" className="bg-indigo-600">
                          {TEACHER_TIERS[t.tierIndex].label.split(" ")[0]}
                        </Badge>
                      </td>
                      <td className="p-3 font-mono">
                        {editingSalaryId === t.id ? (
                          <div className="flex items-center gap-1">
                            <span>¥</span>
                            <Input
                              type="number"
                              value={editSalaryValue}
                              onChange={(e) => setEditSalaryValue(e.target.value)}
                              className="h-7 w-20 text-xs"
                            />
                            <Button
                              onClick={() => handleUpdateSalary(t.id)}
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                            >
                              <Save className="w-3 h-3 text-green-600" />
                            </Button>
                          </div>
                        ) : (
                          <div
                            className="flex items-center gap-1 group cursor-pointer"
                            onClick={() => startEditingSalary(t)}
                          >
                            <span>
                              ¥
                              {t.customBaseSalary && Number.parseFloat(t.customBaseSalary) > 0
                                ? t.customBaseSalary
                                : TEACHER_TIERS[t.tierIndex].base}
                            </span>
                            <Pencil className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100" />
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <Button onClick={() => handleEdit(t)} variant="ghost" size="sm">
                          <Pencil className="w-3 h-3 mr-1" />
                          编辑
                        </Button>
                        <Button onClick={() => handleDelete(t.id)} variant="ghost" size="sm" className="text-red-500">
                          <Trash2 className="w-3 h-3 mr-1" />
                          删除
                        </Button>
                      </td>
                    </tr>
                  )
                })}
                {teachers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-gray-400">
                      暂无数据，请上方录入
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
