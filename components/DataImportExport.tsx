"use client"

import React, { useRef, useState } from "react"
import { useGlobalFinanceData } from "@/contexts/finance-data-context"
import { useNotification } from "@/hooks/use-notification"
import type { Student, TeacherRecord, Expense, BonusRule, Teacher, PresetData } from "@/types"

interface ImportData {
  students?: Student[]
  teacherRecords?: TeacherRecord[]
  expenses?: Expense[]
  bonusRules?: BonusRule[]
  teachers?: Teacher[]
  initialBalance?: number
  presetData?: PresetData
}

export function DataImportExport() {
  const {
    students,
    teacherRecords,
    expenses,
    bonusRules,
    teachers,
    initialBalance,
    presetData,
    loadData,
    setExpenses,
    setPresetData,
  } = useGlobalFinanceData()

  const { notify } = useNotification()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [importMode, setImportMode] = useState<"replace" | "merge">("replace")

  // 导出数据为 JSON 文件
  const handleExport = () => {
    try {
      const data = {
        students,
        teacherRecords,
        expenses,
        bonusRules,
        teachers,
        initialBalance,
        presetData,
        exportedAt: new Date().toISOString(),
      }

      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `finance_data_${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      notify("数据导出成功", "success")
    } catch (error) {
      console.error("Export error:", error)
      notify("数据导出失败", "error")
    }
  }

  // 处理文件导入
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    try {
      const text = await file.text()
      const importedData: ImportData = JSON.parse(text)

      // 验证数据结构
      if (!importedData || typeof importedData !== "object") {
        throw new Error("无效的 JSON 格式")
      }

      // 根据导入模式处理数据
      let finalData: ImportData = { ...importedData }

      if (importMode === "merge") {
        // 合并模式：将新数据添加到现有数据
        finalData = {
          students: [...students, ...(importedData.students || [])],
          teacherRecords: [...teacherRecords, ...(importedData.teacherRecords || [])],
          expenses: [...expenses, ...(importedData.expenses || [])],
          bonusRules: [...bonusRules, ...(importedData.bonusRules || [])],
          teachers: [...teachers, ...(importedData.teachers || [])],
          initialBalance: importedData.initialBalance || initialBalance,
          presetData: { ...presetData, ...(importedData.presetData || {}) },
        }
      }

      // 加载数据
      loadData(finalData)

      // 显示导入统计
      const summary = []
      if (finalData.students?.length) summary.push(`学生: ${finalData.students.length}`)
      if (finalData.teacherRecords?.length) summary.push(`教师记录: ${finalData.teacherRecords.length}`)
      if (finalData.expenses?.length) summary.push(`费用: ${finalData.expenses.length}`)
      if (finalData.presetData) {
        const courseCount = Object.values(finalData.presetData).reduce(
          (acc, major) =>
            acc +
            Object.values(major).reduce(
              (acc2, grade) =>
                acc2 +
                Object.values(grade).reduce((acc3, semester) => acc3 + (Array.isArray(semester) ? semester.length : 0), 0),
              0,
            ),
          0,
        )
        if (courseCount) summary.push(`课程: ${courseCount}`)
      }

      notify(`数据导入成功 | ${summary.join(" | ")}`, "success")
    } catch (error) {
      console.error("Import error:", error)
      const errorMessage = error instanceof Error ? error.message : "未知错误"
      notify(`数据导入失败: ${errorMessage}`, "error")
    } finally {
      setIsLoading(false)
      // 重置文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  // 导入课程配置
  const handleImportCourseConfig = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      if (data.presetData) {
        setPresetData(data.presetData)
        const courseCount = Object.values(data.presetData).reduce(
          (acc: number, major: any) =>
            acc +
            Object.values(major).reduce(
              (acc2: number, grade: any) =>
                acc2 +
                Object.values(grade).reduce(
                  (acc3: number, semester: any) => acc3 + (Array.isArray(semester) ? semester.length : 0),
                  0,
                ),
              0,
            ),
          0,
        )
        notify(`课程配置导入成功: ${courseCount} 门课程`, "success")
      } else {
        throw new Error("未找到课程配置数据")
      }
    } catch (error) {
      console.error("Import error:", error)
      const errorMessage = error instanceof Error ? error.message : "未知错误"
        notify(`课程配置导入失败: ${errorMessage}`, "error")
    } finally {
      setIsLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  // 导入现金记录
  const handleImportExpenses = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      if (data.expenses && Array.isArray(data.expenses)) {
        if (importMode === "merge") {
          setExpenses([...expenses, ...data.expenses])
        } else {
          setExpenses(data.expenses)
        }
        notify(`现金记录导入成功: ${data.expenses.length} 条记录`, "success")
      } else {
        throw new Error("未找到现金记录数据")
      }
    } catch (error) {
      console.error("Import error:", error)
      const errorMessage = error instanceof Error ? error.message : "未知错误"
        notify(`现金记录导入失败: ${errorMessage}`, "error")
    } finally {
      setIsLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">数据导入导出</h3>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">导入模式:</label>
          <select
            value={importMode}
            onChange={(e) => setImportMode(e.target.value as "replace" | "merge")}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="replace">覆盖现有数据</option>
            <option value="merge">合并数据</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {/* 导出按钮 */}
        <button
          onClick={handleExport}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:bg-gray-400"
        >
          <span>📥</span>
          <span>导出全部数据</span>
        </button>

        {/* 导入全部数据 */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            disabled={isLoading}
            className="hidden"
            id="import-all"
          />
          <label
            htmlFor="import-all"
            className="flex cursor-pointer items-center justify-center gap-2 rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600 disabled:bg-gray-400"
          >
            <span>📤</span>
            <span>导入全部数据</span>
          </label>
        </div>

        {/* 导入课程配置 */}
        <div>
          <input
            type="file"
            accept=".json"
            onChange={handleImportCourseConfig}
            disabled={isLoading}
            className="hidden"
            id="import-courses"
          />
          <label
            htmlFor="import-courses"
            className="flex cursor-pointer items-center justify-center gap-2 rounded bg-purple-500 px-4 py-2 text-white hover:bg-purple-600 disabled:bg-gray-400"
          >
            <span>📚</span>
            <span>导入课程配置</span>
          </label>
        </div>

        {/* 导入现金记录 */}
        <div>
          <input
            type="file"
            accept=".json"
            onChange={handleImportExpenses}
            disabled={isLoading}
            className="hidden"
            id="import-expenses"
          />
          <label
            htmlFor="import-expenses"
            className="flex cursor-pointer items-center justify-center gap-2 rounded bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:bg-gray-400"
          >
            <span>💰</span>
            <span>导入现金记录</span>
          </label>
        </div>
      </div>

      <div className="text-sm text-gray-600">
        <p>💡 提示:</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>导出全部数据: 将当前系统中的所有数据导出为 JSON 文件</li>
          <li>导入全部数据: 从 JSON 文件导入完整的财务数据</li>
          <li>导入课程配置: 仅导入课程配置（PresetData）</li>
          <li>导入现金记录: 仅导入现金收支记录（Expenses）</li>
          <li>导入模式: 选择"覆盖"会替换现有数据，"合并"会添加到现有数据</li>
        </ul>
      </div>
    </div>
  )
}
