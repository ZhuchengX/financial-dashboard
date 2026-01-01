"use client"

import type React from "react"
import { createContext, useContext, type ReactNode } from "react"
import { useFinanceData } from "@/hooks/use-finance-data"
import type { Student, TeacherRecord, Expense, BonusRule, Teacher, PresetData } from "@/types"

type FinanceDataContextType = {
  students: Student[]
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>
  teacherRecords: TeacherRecord[]
  setTeacherRecords: React.Dispatch<React.SetStateAction<TeacherRecord[]>>
  expenses: Expense[]
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>
  bonusRules: BonusRule[]
  setBonusRules: React.Dispatch<React.SetStateAction<BonusRule[]>>
  teachers: Teacher[]
  setTeachers: React.Dispatch<React.SetStateAction<Teacher[]>>
  initialBalance: number
  setInitialBalance: React.Dispatch<React.SetStateAction<number>>
  presetData: PresetData
  setPresetData: React.Dispatch<React.SetStateAction<PresetData>>
  coursePresets: Array<{
    major: string
    grade: string
    semester: string
    name: string
    type: string
    hours: number
    rate: number
    defaultTeacher: string
    defaultCost: number
  }>
  isDirty: boolean
  lastSaved: Date | null
  markDirty: () => void
  saveData: () => void
  loadData: (
    data: Partial<{
      students: Student[]
      teacherRecords: TeacherRecord[]
      expenses: Expense[]
      bonusRules: BonusRule[]
      teachers: Teacher[]
      initialBalance: number
      presetData: PresetData
    }>,
  ) => void
}

const FinanceDataContext = createContext<FinanceDataContextType | null>(null)

export function FinanceDataProvider({ children }: { children: ReactNode }) {
  const financeData = useFinanceData()

  return <FinanceDataContext.Provider value={financeData}>{children}</FinanceDataContext.Provider>
}

export function useGlobalFinanceData() {
  const context = useContext(FinanceDataContext)
  if (!context) {
    throw new Error("useGlobalFinanceData must be used within FinanceDataProvider")
  }
  return context
}
