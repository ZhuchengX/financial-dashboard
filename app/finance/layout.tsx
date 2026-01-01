"use client"

import type React from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  Users,
  GraduationCap,
  Wallet,
  Activity,
  Award,
  Shield,
  Folder,
  Save,
  BookCheck,
  UserCheck,
  BookOpen,
} from "lucide-react"
import { NotificationToast } from "@/components/finance/notification-toast"
import { FinanceDataProvider, useGlobalFinanceData } from "@/contexts/finance-data-context"
import { useNotification } from "@/hooks/use-notification"
import { importFromFile, exportToFile } from "@/lib/storage"
import { Button } from "@/components/ui/button"

const tabs = [
  { id: "/finance", label: "经营驾驶舱", icon: Activity },
  { id: "/finance/course-presets", label: "课程信息录入", icon: BookOpen },
  { id: "/finance/teacher-entry", label: "老师信息录入", icon: GraduationCap },
  { id: "/finance/students", label: "学员信息录入", icon: Users },
  { id: "/finance/consumption", label: "学员消课管理", icon: BookCheck },
  { id: "/finance/teaching-staff", label: "老师课酬管理", icon: UserCheck },
  { id: "/finance/expenses", label: "运营杂费", icon: Wallet },
  { id: "/finance/bonus", label: "薪酬分红", icon: Award },
]

function FinanceLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const financeData = useGlobalFinanceData()
  const { notification, notify, clearNotification } = useNotification()

  const handleOpenFile = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        try {
          console.log("[v0] Starting file import...")
          const data = await importFromFile(file)
          console.log("[v0] File parsed, loading data into state...")
          financeData.loadData(data)
          notify("系统数据恢复成功！旧格式数据已自动迁移到新版本。", "success")
          setTimeout(() => {
            window.location.reload()
          }, 500)
        } catch (err) {
          console.error("[v0] File import error:", err)
          notify("文件读取失败，请确保文件格式正确", "error")
        }
      }
    }
    input.click()
  }

  const handleSaveFile = () => {
    exportToFile({
      students: financeData.students,
      teacherRecords: financeData.teacherRecords,
      expenses: financeData.expenses,
      bonusRules: financeData.bonusRules,
      teachers: financeData.teachers,
      initialBalance: financeData.initialBalance,
      presetData: financeData.presetData,
    })
    financeData.saveData()
    notify("整站数据已保存到本地文件", "success")
  }

  return (
    <div className="flex min-h-screen">
      {/* Toast Container */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
        {notification && (
          <div className="pointer-events-auto">
            <NotificationToast notification={notification} onClose={clearNotification} />
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-white flex flex-col p-4">
        <h1 className="text-lg font-bold mb-8 flex items-center gap-2">
          <Shield className="text-blue-400" />
          财务作战系统
        </h1>

        <nav className="space-y-2 flex-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => router.push(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded text-sm transition-colors ${
                pathname === tab.id ? "bg-blue-600 text-white font-medium" : "text-slate-400 hover:bg-slate-800"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-4 border-t border-slate-700 space-y-2">
          <div className="text-xs text-slate-400 mb-2">数据备份与恢复</div>

          <Button
            onClick={handleOpenFile}
            variant="outline"
            size="sm"
            className="w-full bg-slate-700 hover:bg-slate-600 border-slate-600"
          >
            <Folder className="w-3 h-3 mr-2" />
            打开数据文件
          </Button>

          <Button
            onClick={handleSaveFile}
            variant={financeData.isDirty ? "default" : "outline"}
            size="sm"
            className={`w-full ${
              financeData.isDirty
                ? "bg-yellow-600 hover:bg-yellow-500"
                : "bg-slate-700 hover:bg-slate-600 border-slate-600"
            }`}
          >
            <Save className="w-3 h-3 mr-2" />
            {financeData.isDirty ? "保存 (未保存*)" : "保存数据"}
          </Button>

          {financeData.lastSaved && (
            <div className="text-[10px] text-slate-500 text-center pt-1">
              上次保存: {financeData.lastSaved.toLocaleTimeString()}
            </div>
          )}
        </div>

        <div className="mt-4 text-xs text-slate-600 text-center">V6.0 Next.js 重构版</div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-gray-100 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">{children}</div>
      </div>
    </div>
  )
}

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <FinanceDataProvider>
      <FinanceLayoutContent>{children}</FinanceLayoutContent>
    </FinanceDataProvider>
  )
}
