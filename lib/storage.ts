import type { Student, TeacherRecord, Expense, BonusRule, Teacher, PresetData } from "@/types"
import { migrateData } from "@/lib/migration"

export type StorageData = {
  students: Student[]
  teacherRecords: TeacherRecord[]
  expenses: Expense[]
  bonusRules: BonusRule[]
  teachers: Teacher[]
  initialBalance: number
  presetData: PresetData
}

const STORAGE_KEY = "edu_finance_offline_backup"

export function loadFromLocalStorage(): Partial<StorageData> | null {
  if (typeof window === "undefined") return null

  const data = localStorage.getItem(STORAGE_KEY)
  if (!data) return null

  try {
    const parsed = JSON.parse(data)
    console.log("[v0] Raw localStorage keys:", Object.keys(parsed))
    console.log("[v0] Raw teacherRecords count:", parsed.teacherRecords?.length || 0)
    console.log("[v0] Raw teacherCosts count:", parsed.teacherCosts?.length || 0)

    const migrated = migrateData(parsed)
    console.log("[v0] After migration - teacherRecords count:", migrated.teacherRecords?.length || 0)

    return migrated
  } catch (e) {
    console.error("Failed to parse local storage data", e)
    return null
  }
}

export function saveToLocalStorage(data: StorageData): void {
  if (typeof window === "undefined") return
  console.log("[v0] Saving to localStorage with teacherRecords:", data.teacherRecords.length)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function exportToFile(data: StorageData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `finance_data_${new Date().toISOString().split("T")[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function importFromFile(file: File): Promise<Partial<StorageData>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string)
        console.log("[v0] Importing file - raw keys:", Object.keys(parsed))
        console.log("[v0] Importing file - teacherRecords count:", parsed.teacherRecords?.length || 0)
        console.log("[v0] Importing file - teacherCosts count:", parsed.teacherCosts?.length || 0)

        const migrated = migrateData(parsed)
        console.log("[v0] After import migration - teacherRecords count:", migrated.teacherRecords?.length || 0)

        resolve(migrated)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsText(file)
  })
}
