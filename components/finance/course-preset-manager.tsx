"use client"

import type React from "react"

import { useState, useMemo } from "react"
import { Upload, Download, Plus, Trash2, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import type { PresetData, PresetCourse, Teacher } from "@/types"
import { GRADES, MAJORS, SEMESTERS } from "@/lib/constants"
import * as XLSX from "xlsx"

type CoursePresetManagerProps = {
  presetData: PresetData
  setPresetData: (data: PresetData) => void
  teachers: Teacher[]
  setTeachers: (teachers: Teacher[]) => void
  markDirty: () => void
  notify: (message: string, type: "success" | "error" | "info") => void
}

export function CoursePresetManager({
  presetData,
  setPresetData,
  teachers,
  setTeachers,
  markDirty,
  notify,
}: CoursePresetManagerProps) {
  const [selectedMajor, setSelectedMajor] = useState("数学与应用数学D")
  const [selectedGrade, setSelectedGrade] = useState("2024级")
  const [selectedSemester, setSelectedSemester] = useState("第二学年第一学期")
  const [newCourse, setNewCourse] = useState<PresetCourse>({
    name: "",
    type: "大班课",
    hours: 48,
    rate: 50,
    defaultTeacher: "",
    defaultCost: 1200,
  })

  const currentCourses = useMemo(() => {
    return presetData[selectedMajor]?.[selectedGrade]?.[selectedSemester] || []
  }, [presetData, selectedMajor, selectedGrade, selectedSemester])

  const stats = useMemo(() => {
    const group = currentCourses
      .filter((c) => c.type === "大班课")
      .reduce((acc, c) => ({ hours: acc.hours + c.hours, cost: acc.cost + c.hours * c.rate }), { hours: 0, cost: 0 })

    const qna = currentCourses
      .filter((c) => c.type === "答疑课")
      .reduce((acc, c) => ({ hours: acc.hours + c.hours, cost: acc.cost + c.hours * c.rate }), { hours: 0, cost: 0 })

    return { group, qna, total: { hours: group.hours + qna.hours, cost: group.cost + qna.cost } }
  }, [currentCourses])

  const handleAddCourse = () => {
    if (!newCourse.name.trim()) {
      notify("请输入课程名称", "error")
      return
    }

    const updatedData = { ...presetData }
    if (!updatedData[selectedMajor]) updatedData[selectedMajor] = {}
    if (!updatedData[selectedMajor][selectedGrade]) updatedData[selectedMajor][selectedGrade] = {}
    if (!updatedData[selectedMajor][selectedGrade][selectedSemester])
      updatedData[selectedMajor][selectedGrade][selectedSemester] = []

    updatedData[selectedMajor][selectedGrade][selectedSemester].push({ ...newCourse })
    setPresetData(updatedData)
    markDirty()
    notify("课程已添加", "success")

    // Reset form
    setNewCourse({
      name: "",
      type: "大班课",
      hours: 48,
      rate: 50,
      defaultTeacher: "",
      defaultCost: 1200,
    })
  }

  const handleDeleteCourse = (index: number) => {
    const updatedData = { ...presetData }
    updatedData[selectedMajor][selectedGrade][selectedSemester].splice(index, 1)
    setPresetData(updatedData)
    markDirty()
    notify("课程已删除", "success")
  }

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: "binary" })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws)

        const newData: PresetData = {}
        const newTeachersToAdd: Array<{ name: string; basePay: number }> = []
        const existingTeacherNames = new Set(teachers.map((t) => t.name))

        data.forEach((row: any) => {
          const major = row["专业"] || row["major"]
          const grade = row["年级"] || row["grade"]
          const semester = row["学期"] || row["semester"]
          const name = row["课程名称"] || row["course"]
          const hours = row["总课时"] || row["hours"]
          const rate = row["单价"] || row["rate"]
          const type = row["课程类型"] || row["type"] || "大班课"
          const defaultTeacher = row["默认老师"] || row["teacher"]
          const defaultCost = row["默认课酬"] || row["cost"]

          if (defaultTeacher && !existingTeacherNames.has(defaultTeacher)) {
            const alreadyAdded = newTeachersToAdd.find((t) => t.name === defaultTeacher)
            if (!alreadyAdded) {
              newTeachersToAdd.push({
                name: defaultTeacher,
                basePay: Number(defaultCost) || 0,
              })
              existingTeacherNames.add(defaultTeacher)
            }
          }

          if (major && grade && semester && name) {
            if (!newData[major]) newData[major] = {}
            if (!newData[major][grade]) newData[major][grade] = {}
            if (!newData[major][grade][semester]) newData[major][grade][semester] = []
            newData[major][grade][semester].push({
              name,
              type,
              hours: Number(hours) || 0,
              rate: Number(rate) || 0,
              defaultTeacher,
              defaultCost: Number(defaultCost) || 0,
            })
          }
        })

        if (newTeachersToAdd.length > 0) {
          const updatedTeachers = [...teachers]
          newTeachersToAdd.forEach(({ name, basePay }) => {
            updatedTeachers.push({
              id: `t${Date.now()}${Math.random().toString(36).substring(2, 9)}`,
              name,
              gradSchool: "无 / 出国 / 其他",
              rankPos: "",
              rankTotal: "",
              tierIndex: 5,
              customBaseSalary: basePay.toString(),
            })
          })
          setTeachers(updatedTeachers)
          notify(`成功导入课程配置！自动添加 ${newTeachersToAdd.length} 位新老师到在库老师列表`, "success")
        } else {
          notify("成功导入课程配置！", "success")
        }

        setPresetData({ ...presetData, ...newData })
        markDirty()
      } catch (err) {
        notify("导入失败，请检查文件格式", "error")
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = ""
  }

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        专业: "数学与应用数学D",
        年级: "2024级",
        学期: "第二学年第一学期",
        课程名称: "示例课程A",
        课程类型: "大班课",
        总课时: 40,
        单价: 50,
        默认老师: "张教授",
        默认课酬: 1200,
      },
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "模板")

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    const blob = new Blob([wbout], { type: "application/octet-stream" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "课程配置模板.xlsx"
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportCurrent = () => {
    const exportData: any[] = []
    Object.entries(presetData).forEach(([major, grades]) => {
      Object.entries(grades).forEach(([grade, semesters]) => {
        Object.entries(semesters).forEach(([semester, courses]) => {
          courses.forEach((course) => {
            exportData.push({
              专业: major,
              年级: grade,
              学期: semester,
              课程名称: course.name,
              课程类型: course.type,
              总课时: course.hours,
              单价: course.rate,
              默认老师: course.defaultTeacher || "",
              默认课酬: course.defaultCost || 0,
            })
          })
        })
      })
    })

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "课程配置")

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    const blob = new Blob([wbout], { type: "application/octet-stream" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "课程配置导出.xlsx"
    a.click()
    URL.revokeObjectURL(url)

    notify("已导出所有课程配置", "success")
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <CardTitle>课程包精细配置</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleDownloadTemplate} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                下载模板
              </Button>
              <Button onClick={handleExportCurrent} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                导出配置
              </Button>
              <label>
                <Button variant="default" size="sm" asChild>
                  <span className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    导入配置
                  </span>
                </Button>
                <input type="file" accept=".xlsx,.csv" className="hidden" onChange={handleImportExcel} />
              </label>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <div className="text-center">
              <div className="text-sm text-blue-600 font-bold mb-1">大班课</div>
              <div className="text-xs text-gray-500">{stats.group.hours}课时</div>
              <div className="text-lg font-bold text-blue-700">¥{stats.group.cost.toLocaleString()}</div>
            </div>
            <div className="text-center border-x border-blue-200">
              <div className="text-sm text-orange-600 font-bold mb-1">答疑课</div>
              <div className="text-xs text-gray-500">{stats.qna.hours}课时</div>
              <div className="text-lg font-bold text-orange-700">¥{stats.qna.cost.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-green-600 font-bold mb-1">总计</div>
              <div className="text-xs text-gray-500">{stats.total.hours}课时</div>
              <div className="text-lg font-bold text-green-700">¥{stats.total.cost.toLocaleString()}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>专业</Label>
              <Select value={selectedMajor} onValueChange={setSelectedMajor}>
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

            <div className="space-y-2">
              <Label>年级</Label>
              <Select value={selectedGrade} onValueChange={setSelectedGrade}>
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
              <Label>学期</Label>
              <Select value={selectedSemester} onValueChange={setSelectedSemester}>
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="w-4 h-4" />
            添加新课程
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">课程名称 *</Label>
              <Input
                value={newCourse.name}
                onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                placeholder="例: 数学分析I"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">类型</Label>
              <Select value={newCourse.type} onValueChange={(value) => setNewCourse({ ...newCourse, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="大班课">大班课</SelectItem>
                  <SelectItem value="答疑课">答疑课</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">总课时</Label>
              <Input
                type="number"
                value={newCourse.hours}
                onChange={(e) => setNewCourse({ ...newCourse, hours: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">单价</Label>
              <Input
                type="number"
                value={newCourse.rate}
                onChange={(e) => setNewCourse({ ...newCourse, rate: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">默认老师</Label>
              <Input
                value={newCourse.defaultTeacher}
                onChange={(e) => setNewCourse({ ...newCourse, defaultTeacher: e.target.value })}
                placeholder="可选"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">默认课酬</Label>
              <Input
                type="number"
                value={newCourse.defaultCost}
                onChange={(e) => setNewCourse({ ...newCourse, defaultCost: Number(e.target.value) })}
              />
            </div>
          </div>

          <Button onClick={handleAddCourse} className="w-full mt-4">
            <Plus className="w-4 h-4 mr-2" />
            添加课程到 {selectedMajor.substring(0, 4)} - {selectedGrade} - {selectedSemester}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            当前配置课程
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({selectedMajor.substring(0, 4)} - {selectedGrade} - {selectedSemester})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentCourses.length === 0 ? (
            <div className="text-center py-8 text-gray-400">该学期暂无课程配置，请添加课程</div>
          ) : (
            <div className="space-y-2">
              {currentCourses.map((course, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg bg-white hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Badge variant={course.type === "大班课" ? "default" : "secondary"}>{course.type}</Badge>
                    <div className="flex-1">
                      <div className="font-medium">{course.name}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {course.hours}课时 × ¥{course.rate} = ¥{course.hours * course.rate}
                      </div>
                    </div>
                    {course.defaultTeacher && (
                      <div className="text-xs text-gray-600">
                        默认老师: {course.defaultTeacher} (¥{course.defaultCost})
                      </div>
                    )}
                  </div>
                  <Button onClick={() => handleDeleteCourse(index)} variant="ghost" size="sm">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
