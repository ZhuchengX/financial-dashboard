"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { loadFromLocalStorage, saveToLocalStorage, type StorageData } from "@/lib/storage"
import { DEFAULT_PRESET_DATA } from "@/lib/constants"
import type { Student, TeacherRecord, Expense, BonusRule, Teacher, PresetData } from "@/types"

export function useFinanceData() {
  const [students, setStudents] = useState<Student[]>([])
  const [teacherRecords, setTeacherRecords] = useState<TeacherRecord[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [bonusRules, setBonusRules] = useState<BonusRule[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [initialBalance, setInitialBalance] = useState(0)
  const [presetData, setPresetData] = useState<PresetData>(DEFAULT_PRESET_DATA)
  const [isDirty, setIsDirty] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const studentsRef = useRef(students)
  const teacherRecordsRef = useRef(teacherRecords)
  const expensesRef = useRef(expenses)
  const bonusRulesRef = useRef(bonusRules)
  const teachersRef = useRef(teachers)
  const initialBalanceRef = useRef(initialBalance)
  const presetDataRef = useRef(presetData)

  useEffect(() => {
    studentsRef.current = students
  }, [students])
  useEffect(() => {
    teacherRecordsRef.current = teacherRecords
  }, [teacherRecords])
  useEffect(() => {
    expensesRef.current = expenses
  }, [expenses])
  useEffect(() => {
    bonusRulesRef.current = bonusRules
  }, [bonusRules])
  useEffect(() => {
    teachersRef.current = teachers
  }, [teachers])
  useEffect(() => {
    initialBalanceRef.current = initialBalance
  }, [initialBalance])
  useEffect(() => {
    presetDataRef.current = presetData
  }, [presetData])

  // Load from localStorage on mount
  useEffect(() => {
    const data = loadFromLocalStorage()
    if (data) {
      console.log("[v0] Loading finance data from localStorage")
      console.log("[v0] Loaded teacherRecords count:", data.teacherRecords?.length || 0)
      if (data.students) setStudents(data.students)
      if (data.teacherRecords) {
        console.log("[v0] Setting teacherRecords state with", data.teacherRecords.length, "records")
        setTeacherRecords(data.teacherRecords)
      }
      if (data.expenses) setExpenses(data.expenses)
      if (data.bonusRules) setBonusRules(data.bonusRules)
      if (data.teachers) setTeachers(data.teachers)
      if (data.initialBalance) setInitialBalance(data.initialBalance)
      if (data.presetData) setPresetData(data.presetData)
    }
  }, [])

  useEffect(() => {
    console.log("[v0] teacherRecords state updated, count:", teacherRecords.length)
  }, [teacherRecords])

  useEffect(() => {
    if (isDirty) {
      // Use setTimeout to ensure all state updates are flushed
      const timeoutId = setTimeout(() => {
        const data: StorageData = {
          students: studentsRef.current,
          teacherRecords: teacherRecordsRef.current,
          expenses: expensesRef.current,
          bonusRules: bonusRulesRef.current,
          teachers: teachersRef.current,
          initialBalance: initialBalanceRef.current,
          presetData: presetDataRef.current,
        }
        console.log("[v0] Auto-saving with students count:", data.students.length)
        console.log("[v0] Auto-saving with teacherRecords count:", data.teacherRecords.length)
        saveToLocalStorage(data)
        console.log("[v0] Auto-saved finance data to localStorage")
        setLastSaved(new Date())
        setIsDirty(false)
      }, 100) // Small delay to ensure all state updates are processed

      return () => clearTimeout(timeoutId)
    }
  }, [isDirty])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (students.length > 0 || teacherRecords.length > 0) {
        const data: StorageData = {
          students,
          teacherRecords,
          expenses,
          bonusRules,
          teachers,
          initialBalance,
          presetData,
        }
        saveToLocalStorage(data)
        console.log("[v0] Data change auto-save completed")
      }
    }, 200)

    return () => clearTimeout(timeoutId)
  }, [students, teacherRecords, expenses, bonusRules, teachers, initialBalance, presetData])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isDirty])

  const markDirty = useCallback(() => setIsDirty(true), [])

  const saveData = useCallback(() => {
    const data: StorageData = {
      students: studentsRef.current,
      teacherRecords: teacherRecordsRef.current,
      expenses: expensesRef.current,
      bonusRules: bonusRulesRef.current,
      teachers: teachersRef.current,
      initialBalance: initialBalanceRef.current,
      presetData: presetDataRef.current,
    }
    saveToLocalStorage(data)
    setIsDirty(false)
    setLastSaved(new Date())
    console.log("[v0] Manually saved finance data")
  }, [])

  const loadData = useCallback((data: Partial<StorageData>) => {
    console.log("[v0] Loading imported data:", {
      studentsCount: data.students?.length || 0,
      teachersCount: data.teachers?.length || 0,
      recordsCount: data.teacherRecords?.length || 0,
    })

    if (data.students) setStudents(data.students)
    if (data.teacherRecords) {
      console.log("[v0] Setting imported teacherRecords:", data.teacherRecords.length)
      setTeacherRecords(data.teacherRecords)
    }
    if (data.expenses) setExpenses(data.expenses)
    if (data.bonusRules) setBonusRules(data.bonusRules)
    if (data.teachers) setTeachers(data.teachers)
    if (data.initialBalance !== undefined) setInitialBalance(data.initialBalance)
    if (data.presetData) setPresetData(data.presetData)

    const fullData: StorageData = {
      students: data.students || [],
      teacherRecords: data.teacherRecords || [],
      expenses: data.expenses || [],
      bonusRules: data.bonusRules || [],
      teachers: data.teachers || [],
      initialBalance: data.initialBalance || 0,
      presetData: data.presetData || DEFAULT_PRESET_DATA,
    }
    console.log("[v0] Saving to localStorage with teacherRecords:", fullData.teacherRecords.length)
    saveToLocalStorage(fullData)
    console.log("[v0] Saved imported data to localStorage")

    setIsDirty(false)
    setLastSaved(new Date())
  }, [])

  const coursePresets = useMemo(() => {
    const result: Array<{
      major: string
      grade: string
      semester: string
      name: string
      type: string
      hours: number
      rate: number
      defaultTeacher: string
      defaultCost: number
    }> = []

    Object.entries(presetData).forEach(([major, gradeData]) => {
      Object.entries(gradeData).forEach(([grade, semesterData]) => {
        Object.entries(semesterData).forEach(([semester, courses]) => {
          courses.forEach((course) => {
            result.push({
              major,
              grade,
              semester,
              name: course.name,
              type: course.type,
              hours: course.hours,
              rate: course.rate,
              defaultTeacher: course.defaultTeacher || "",
              defaultCost: course.defaultCost || 0,
            })
          })
        })
      })
    })

    return result
  }, [presetData])

  return {
    students,
    setStudents,
    teacherRecords,
    setTeacherRecords,
    expenses,
    setExpenses,
    bonusRules,
    setBonusRules,
    teachers,
    setTeachers,
    initialBalance,
    setInitialBalance,
    presetData,
    setPresetData,
    coursePresets,
    isDirty,
    lastSaved,
    markDirty,
    saveData,
    loadData,
  }
}
