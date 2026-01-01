import { MAJOR_ORDER } from "@/lib/constants"
import type { Student } from "@/types"

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9)
}

export function sortStudents(students: Student[]): Student[] {
  return [...students].sort((a, b) => {
    // First by grade (2023级, 2024级, 2025级)
    if (a.grade !== b.grade) return a.grade.localeCompare(b.grade)

    // Then by major in the specific order defined
    const m1 = MAJOR_ORDER[a.major as keyof typeof MAJOR_ORDER] || 99
    const m2 = MAJOR_ORDER[b.major as keyof typeof MAJOR_ORDER] || 99
    if (m1 !== m2) return m1 - m2

    // Finally by name
    return a.name.localeCompare(b.name)
  })
}

export function calculateTierFromSchoolAndRank(
  gradSchool: string,
  rankPos: string,
  rankTotal: string,
  SCHOOL_LIST: { name: string; tier: number }[],
): number {
  let schoolTier = 5
  const schoolObj = SCHOOL_LIST.find((s) => s.name === gradSchool)
  if (schoolObj) schoolTier = schoolObj.tier

  let rankTier = 5
  const pos = Number.parseFloat(rankPos)
  const total = Number.parseFloat(rankTotal)
  if (pos && total) {
    const pct = (pos / total) * 100
    if (pct <= 5) rankTier = 1
    else if (pct <= 10) rankTier = 2
    else if (pct <= 15) rankTier = 3
    else if (pct <= 20) rankTier = 4
  }

  return Math.min(schoolTier, rankTier)
}
