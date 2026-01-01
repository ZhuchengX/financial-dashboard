"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BookOpen, Upload, Download, Trash2 } from "lucide-react"
import * as XLSX from "xlsx"
import type { PresetData, PresetCourse, Teacher } from "@/types"
import { MAJORS, GRADES, SEMESTERS } from "@/lib/constants"

type Props = {
  presetData: PresetData
  setPresetData: (data: PresetData) => void
  teachers: Teacher[]
  setTeachers: (teachers: Teacher[]) => void
  markDirty: () => void
  notify: (message: string, type: "success" | "error" | "info") => void
}

export function CoursePresetManagement({ presetData, setPresetData, teachers, setTeachers, markDirty, notify }: Props) {
  const [filterMajor, setFilterMajor] = useState("全部专业")
  const [filterGrade, setFilterGrade] = useState("全部年级")
  const [filterSemester, setFilterSemester] = useState("全部学期")

  const handleImportPresets = useCallback(
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

          const newPresetData: PresetData = {}
          const newTeachersToAdd: Array<{ name: string; basePay: number }> = []
          const teachersToUpdate: Array<{ name: string; basePay: number }> = []
          const existingTeacherNames = new Set(teachers.map((t) => t.name))

          rows.forEach((row: any) => {
            const major = row["专业"] || ""
            const grade = row["年级"] || ""
            const semester = row["学期"] || ""
            const courseName = row["课程名称"] || ""
            const courseType = row["课程类型"] || "大班课"
            const hours = Number(row["总课时"] || 0)
            const rate = Number(row["单价"] || 0)
            const defaultTeacher = row["默认老师"] || ""
            const defaultCost = Number(row["默认课酬"] || 0)

            if (!major || !grade || !semester || !courseName) return

            if (defaultTeacher) {
              if (!existingTeacherNames.has(defaultTeacher)) {
                const alreadyAdded = newTeachersToAdd.find((t) => t.name === defaultTeacher)
                if (!alreadyAdded) {
                  newTeachersToAdd.push({
                    name: defaultTeacher,
                    basePay: defaultCost || 0,
                  })
                  existingTeacherNames.add(defaultTeacher)
                }
              } else {
                const alreadyMarked = teachersToUpdate.find((t) => t.name === defaultTeacher)
                if (!alreadyMarked) {
                  teachersToUpdate.push({
                    name: defaultTeacher,
                    basePay: defaultCost || 0,
                  })
                }
              }
            }

            if (!newPresetData[major]) {
              newPresetData[major] = {}
            }
            if (!newPresetData[major][grade]) {
              newPresetData[major][grade] = {}
            }
            if (!newPresetData[major][grade][semester]) {
              newPresetData[major][grade][semester] = []
            }

            newPresetData[major][grade][semester].push({
              name: courseName,
              type: courseType,
              hours,
              rate,
              defaultTeacher,
              defaultCost,
            })
          })

          let updatedTeachers = [...teachers]

          if (teachersToUpdate.length > 0) {
            updatedTeachers = updatedTeachers.map((teacher) => {
              const updateInfo = teachersToUpdate.find((t) => t.name === teacher.name)
              if (updateInfo && updateInfo.basePay > 0) {
                return {
                  ...teacher,
                  customBaseSalary: updateInfo.basePay.toString(),
                }
              }
              return teacher
            })
          }

          if (newTeachersToAdd.length > 0) {
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
          }

          setTeachers(updatedTeachers)

          const messages = []
          if (newTeachersToAdd.length > 0) {
            messages.push(`新增 ${newTeachersToAdd.length} 位老师`)
          }
          if (teachersToUpdate.length > 0) {
            messages.push(`更新 ${teachersToUpdate.length} 位老师的课酬`)
          }

          if (messages.length > 0) {
            notify(`成功导入 ${rows.length} 条课程配置，${messages.join("，")}`, "success")
          } else {
            notify(`成功导入 ${rows.length} 条课程配置`, "success")
          }

          setPresetData(newPresetData)
          markDirty()
        } catch (error) {
          console.error("Import error:", error)
          notify("Excel 文件格式错误", "error")
        }
      }
      reader.readAsBinaryString(file)
      e.target.value = ""
    },
    [notify, setPresetData, teachers, setTeachers, markDirty],
  )

  const handleExportPresets = useCallback(() => {
    const exportData: any[] = []

    Object.entries(presetData).forEach(([major, gradeData]) => {
      Object.entries(gradeData).forEach(([grade, semesterData]) => {
        Object.entries(semesterData).forEach(([semester, courses]) => {
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

    if (exportData.length === 0) {
      notify("暂无课程配置可导出", "info")
      return
    }

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "课程配置")

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    const blob = new Blob([wbout], { type: "application/octet-stream" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `课程配置_${new Date().toISOString().split("T")[0]}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    notify(`成功导出 ${exportData.length} 条课程配置`, "success")
  }, [presetData, notify])

  const handleDownloadTemplate = useCallback(() => {
    const template = [
      {
        专业: "数学与应用数学D",
        年级: "2023级",
        学期: "第三学年第一学期",
        课程名称: "数学分析（大班）",
        课程类型: "大班课",
        总课时: 25,
        单价: 300,
        默认老师: "待定",
        默认课酬: 600,
      },
      {
        专业: "数学与应用数学D",
        年级: "2023级",
        学期: "第三学年第一学期",
        课程名称: "高等代数（答疑）",
        课程类型: "答疑课",
        总课时: 6,
        单价: 300,
        默认老师: "待定",
        默认课酬: 600,
      },
    ]

    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "课程配置模板")

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    const blob = new Blob([wbout], { type: "application/octet-stream" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "课程配置模板.xlsx"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  const filteredCourses: Array<{
    major: string
    grade: string
    semester: string
    course: PresetCourse
  }> = []

  Object.entries(presetData).forEach(([major, gradeData]) => {
    if (filterMajor !== "全部专业" && major !== filterMajor) return

    Object.entries(gradeData).forEach(([grade, semesterData]) => {
      if (filterGrade !== "全部年级" && grade !== filterGrade) return

      Object.entries(semesterData).forEach(([semester, courses]) => {
        if (filterSemester !== "全部学期" && semester !== filterSemester) return

        courses.forEach((course) => {
          filteredCourses.push({ major, grade, semester, course })
        })
      })
    })
  })

  const deleteCourse = useCallback(
    (major: string, grade: string, semester: string, courseName: string) => {
      const newData = { ...presetData }
      if (newData[major]?.[grade]?.[semester]) {
        newData[major][grade][semester] = newData[major][grade][semester].filter((c) => c.name !== courseName)
        setPresetData(newData)
        notify("删除成功", "success")
      }
    },
    [presetData, setPresetData, notify],
  )

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            课程信息录入
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
                  导入配置
                </span>
              </Button>
              <input type="file" accept=".xlsx,.xls" onChange={handleImportPresets} className="hidden" />
            </label>
            <Button variant="outline" onClick={handleExportPresets}>
              <Download className="w-4 h-4 mr-2" />
              导出配置
            </Button>
          </div>

          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
            <p className="font-medium mb-1">使用说明：</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>点击"下载模板"获取Excel模板</li>
              <li>在模板中填写：专业、年级、学期、课程名称、课程类型、总课时、单价、默认老师、默认课酬</li>
              <li>点击"导入配置"上传填写好的Excel文件，系统自动保存</li>
              <li>如需修改，点击"导出配置"下载当前配置，修改后重新导入</li>
              <li>导入后，学员信息录入时将自动加载对应课程包</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">课程筛选</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Select value={filterMajor} onValueChange={setFilterMajor}>
              <SelectTrigger>
                <SelectValue placeholder="选择专业" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="全部专业">全部专业</SelectItem>
                {MAJORS.map((major) => (
                  <SelectItem key={major} value={major}>
                    {major}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterGrade} onValueChange={setFilterGrade}>
              <SelectTrigger>
                <SelectValue placeholder="选择年级" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="全部年级">全部年级</SelectItem>
                {GRADES.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    {grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterSemester} onValueChange={setFilterSemester}>
              <SelectTrigger>
                <SelectValue placeholder="选择学期" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="全部学期">全部学期</SelectItem>
                {SEMESTERS.map((semester) => (
                  <SelectItem key={semester} value={semester}>
                    {semester}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Course List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">课程列表 ({filteredCourses.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCourses.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>暂无课程配置</p>
              <p className="text-sm mt-1">请导入Excel文件添加课程</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredCourses.map((item, index) => (
                <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      {/* Row 1: Basic Info + Course */}
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">专业：</span>
                            <span className="font-medium">{item.major}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">年级：</span>
                            <span className="font-medium">{item.grade}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">学期：</span>
                            <span className="font-medium">{item.semester}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-sm">课程：</span>
                          <span className="font-medium text-base">{item.course.name}</span>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              item.course.type === "大班课"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-orange-100 text-orange-700"
                            }`}
                          >
                            {item.course.type}
                          </span>
                        </div>
                      </div>

                      {/* Row 2: Course Details */}
                      <div className="flex items-center gap-6 text-sm pl-4 border-l-2 border-gray-200">
                        <div>
                          <span className="text-gray-500">课时：</span>
                          <span className="font-medium">{item.course.hours}h</span>
                        </div>
                        <div>
                          <span className="text-gray-500">单价：</span>
                          <span className="font-medium text-blue-600">¥{item.course.rate}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">老师：</span>
                          <span className="font-medium">{item.course.defaultTeacher || "待定"}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">课酬：</span>
                          <span className="font-medium text-green-600">¥{item.course.defaultCost || 0}</span>
                        </div>
                      </div>
                    </div>

                    {/* Delete Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteCourse(item.major, item.grade, item.semester, item.course.name)}
                      className="mt-1"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
