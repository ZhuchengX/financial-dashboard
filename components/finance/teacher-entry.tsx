"use client"

import type React from "react"
import { useState, useCallback, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Users, Upload, Download, Pencil, Trash2, Save } from "lucide-react"
import * as XLSX from "xlsx"
import type { Teacher } from "@/types"
import { TEACHER_TIERS, SCHOOL_LIST } from "@/lib/constants"
import { generateId } from "@/lib/utils/helpers"

type Props = {
  teachers: Teacher[]
  setTeachers: (teachers: Teacher[]) => void
  markDirty: () => void
  notify: (message: string, type: "success" | "error" | "info") => void
}

export function TeacherEntry({ teachers, setTeachers, markDirty, notify }: Props) {
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

  useEffect(() => {
    // Skip auto-calculation if editing existing teacher
    if (isEditing) return

    let schoolTier = 5
    const schoolObj = SCHOOL_LIST.find((s) => s.name === form.gradSchool)
    if (schoolObj) {
      schoolTier = schoolObj.tier
    }

    let rankTier = 5
    const pos = Number.parseFloat(form.rankPos)
    const total = Number.parseFloat(form.rankTotal)
    if (pos && total && total > 0) {
      const pct = (pos / total) * 100
      if (pct <= 5)
        rankTier = 1 // T2 (index 1)
      else if (pct <= 10)
        rankTier = 2 // T3 (index 2)
      else if (pct <= 15)
        rankTier = 3 // T4 (index 3)
      else if (pct <= 20)
        rankTier = 4 // T5 (index 4)
      else rankTier = 4 // Beyond 20% also T5
    }

    const calculatedTier = Math.min(schoolTier, rankTier)
    const finalTier = Math.min(Math.max(0, calculatedTier), 5)

    // Always update tier and auto-fill base salary from tier
    if (finalTier !== form.tierIndex) {
      setForm((prev) => ({
        ...prev,
        tierIndex: finalTier,
        customBaseSalary: String(TEACHER_TIERS[finalTier].base),
      }))
    }
  }, [form.gradSchool, form.rankPos, form.rankTotal, isEditing, form.tierIndex])

  const handleDownloadTemplate = useCallback(() => {
    const template = [
      {
        姓名: "张三",
        保研去向: "清华大学",
        排名名次: "2",
        排名总数: "50",
        基准课酬: "800",
      },
      {
        姓名: "李四",
        保研去向: "北京大学",
        排名名次: "5",
        排名总数: "60",
        基准课酬: "750",
      },
    ]

    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "教师信息模板")

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    const blob = new Blob([wbout], { type: "application/octet-stream" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "教师信息模板.xlsx"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  const handleImportTeachers = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (evt) => {
        try {
          const data = evt.target?.result
          const workbook = XLSX.read(data, { type: "binary" })
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          const rows = XLSX.utils.sheet_to_json<any>(firstSheet)

          if (rows.length === 0) {
            notify("Excel文件为空", "error")
            return
          }

          const importedTeachers: Teacher[] = []

          rows.forEach((row: any) => {
            const name = row["姓名"] || ""
            const gradSchool = row["保研去向"] || ""
            const rankPos = String(row["排名名次"] || "")
            const rankTotal = String(row["排名总数"] || "")
            const customBaseSalary = String(row["基准课酬"] || "")

            if (!name || !gradSchool) return

            // Auto-calculate tier
            let schoolTier = 5
            const schoolObj = SCHOOL_LIST.find((s) => s.name === gradSchool)
            if (schoolObj) schoolTier = schoolObj.tier

            let rankTier = 5
            const pos = Number.parseFloat(rankPos)
            const total = Number.parseFloat(rankTotal)
            if (pos && total) {
              const pct = (pos / total) * 100
              if (pct <= 5)
                rankTier = 1 // T2 (index 1)
              else if (pct <= 10)
                rankTier = 2 // T3 (index 2)
              else if (pct <= 15)
                rankTier = 3 // T4 (index 3)
              else if (pct <= 20)
                rankTier = 4 // T5 (index 4)
              else rankTier = 4 // Beyond 20% also T5
            }

            const tierIndex = Math.min(schoolTier, rankTier)

            importedTeachers.push({
              id: generateId(),
              name,
              gradSchool,
              rankPos,
              rankTotal,
              tierIndex: Math.min(Math.max(0, tierIndex), 5),
              customBaseSalary,
            })
          })

          // Merge with existing teachers (avoid duplicates by name)
          const existingNames = new Set(teachers.map((t) => t.name))
          const newTeachers = importedTeachers.filter((t) => !existingNames.has(t.name))
          const updatedTeachers = [...teachers, ...newTeachers]

          setTeachers(updatedTeachers)
          markDirty()
          notify(
            `成功导入 ${newTeachers.length} 位老师（已跳过 ${importedTeachers.length - newTeachers.length} 位重名）`,
            "success",
          )
        } catch (error) {
          console.error("Import error:", error)
          notify("Excel 文件格式错误", "error")
        }
      }
      reader.readAsBinaryString(file)
      e.target.value = ""
    },
    [notify, teachers, setTeachers, markDirty],
  )

  const handleExportTeachers = useCallback(() => {
    if (teachers.length === 0) {
      notify("暂无教师信息可导出", "info")
      return
    }

    const exportData = teachers.map((t) => ({
      姓名: t.name,
      保研去向: t.gradSchool,
      排名名次: t.rankPos,
      排名总数: t.rankTotal,
      定级: TEACHER_TIERS[t.tierIndex].label.split(" ")[0],
      基准课酬: t.customBaseSalary || TEACHER_TIERS[t.tierIndex].base,
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "教师信息")

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    const blob = new Blob([wbout], { type: "application/octet-stream" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `教师信息_${new Date().toISOString().split("T")[0]}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    notify(`成功导出 ${teachers.length} 位老师信息`, "success")
  }, [teachers, notify])

  const handleSubmit = () => {
    console.log("[v0] Teacher form submission triggered")
    console.log("[v0] Form data:", form)

    if (!form.name || !form.gradSchool) {
      console.log("[v0] Validation failed - missing name or school")
      notify("请补全姓名和学校", "error")
      return
    }

    console.log("[v0] Validation passed, creating new teacher")
    const newTeacher = { ...form, id: isEditing ? form.id : generateId() }
    console.log("[v0] New teacher object:", newTeacher)

    if (isEditing) {
      setTeachers(teachers.map((t) => (t.id === form.id ? newTeacher : t)))
      notify("老师信息已更新", "success")
    } else {
      if (teachers.find((t) => t.name === form.name)) {
        console.log("[v0] Teacher already exists with this name")
        notify("该老师已存在", "error")
        return
      }
      console.log("[v0] Adding new teacher to list")
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
    const updated = teachers.map((t) => (t.id === id ? { ...t, customBaseSalary: editSalaryValue } : t))
    setTeachers(updated)
    markDirty()
    setEditingSalaryId(null)
    notify("基准课酬已更新", "success")
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
      {/* Import/Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            老师信息录入
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              下载模板
            </Button>
            <label>
              <Button variant="default" asChild>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  导入信息
                </span>
              </Button>
              <input type="file" accept=".xlsx,.xls" onChange={handleImportTeachers} className="hidden" />
            </label>
            <Button variant="outline" onClick={handleExportTeachers}>
              <Download className="w-4 h-4 mr-2" />
              导出信息
            </Button>
          </div>

          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
            <p className="font-medium mb-1">使用说明：</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>点击"下载模板"获取Excel模板</li>
              <li>在模板中填写：姓名、保研去向、排名名次、排名总数、基准课酬</li>
              <li>点击"导入信息"上传填写好的Excel文件，系统自动保存并计算定级</li>
              <li>如需修改，点击"导出信息"下载当前信息，修改后重新导入</li>
              <li>也可以通过下方表单手动添加和编辑老师信息</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Manual Entry Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">手动录入</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="space-y-2 md:col-span-2">
              <Label>姓名</Label>
              <Input
                value={form.name || ""} // Ensure value is always a string
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="输入姓名"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>保研去向</Label>
              <Select value={form.gradSchool || ""} onValueChange={(value) => setForm({ ...form, gradSchool: value })}>
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

            <div className="space-y-2 md:col-span-2">
              <Label>专业排名</Label>
              <div className="flex gap-1 items-center">
                <Input
                  type="number"
                  placeholder="名次"
                  value={form.rankPos || ""} // Ensure value is always a string
                  onChange={(e) => setForm({ ...form, rankPos: e.target.value })}
                />
                <span className="text-gray-400">/</span>
                <Input
                  type="number"
                  placeholder="总数"
                  value={form.rankTotal || ""} // Ensure value is always a string
                  onChange={(e) => setForm({ ...form, rankTotal: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2 md:col-span-3">
              <Label>系统定级</Label>
              <div className="px-3 py-2 bg-indigo-50 text-indigo-700 font-bold rounded border border-indigo-200 whitespace-nowrap overflow-x-auto">
                {TEACHER_TIERS[form.tierIndex].label}
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>基准课酬 (元/h)</Label>
              <Input
                type="number"
                placeholder="自定义"
                value={form.customBaseSalary || ""} // Ensure value is always a string
                onChange={(e) => setForm({ ...form, customBaseSalary: e.target.value })}
              />
            </div>

            <div className="md:col-span-1">
              <Button onClick={handleSubmit} className="bg-indigo-600 hover:bg-indigo-700 w-full">
                {isEditing ? "保存修改" : "添加老师"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Teacher List */}
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
                              value={editSalaryValue || ""} // Ensure value is always a string
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
                      暂无数据，请导入Excel或上方手动录入
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
