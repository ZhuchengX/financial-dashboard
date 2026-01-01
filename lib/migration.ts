import type { Student, Course, LegacyStudent, LegacyCourse, LegacyData, StudentMemberType } from "@/types"
import type { StorageData } from "@/lib/storage"

function migrateLegacyStudent(legacy: LegacyStudent): Student {
  // Determine member type based on isTeamMember flag
  const memberType: StudentMemberType = legacy.isTeamMember ? "Core" : "Normal"

  // Convert courses
  const courses: Course[] = legacy.courses.map((c: LegacyCourse) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    semester: c.semester,
    totalHours: c.totalHours,
    attendedHours: c.attendedHours,
    hourlyRate: c.hourlyRate,
    totalCost: c.totalCost,
    isPaid: c.isPaid,
    teacherName: c.teacherName,
    teacherTierIndex: c.teacherTierIndex,
    teacherBaseCost: c.teacherBaseCost,
    additionalTeachers: c.additionalTeachers || [],
    projectTag: c.projectTag,
    paymentDate: c.paymentDate || "",
  }))

  // Get first course data for student-level fields
  const firstCourse = courses[0]

  return {
    id: legacy.id,
    name: legacy.name,
    grade: legacy.grade,
    major: legacy.major,
    semester: firstCourse?.semester || "",
    isPaid: firstCourse?.isPaid || false,
    paymentDate: firstCourse?.paymentDate || "",
    receiptName: firstCourse?.paymentDate || "",
    teacherName: firstCourse?.teacherName || "",
    courses,
    referrer: "",
    referrerRate: 0,
    closer: "",
    closerRate: 0,
    memberType,
    isTeamMember: legacy.isTeamMember,
  }
}

export function isLegacyData(data: any): data is LegacyData {
  // Check if students array exists and has legacy structure
  if (!data.students || !Array.isArray(data.students)) {
    return false
  }

  // Legacy students have isTeamMember and don't have memberType
  const firstStudent = data.students[0]
  if (!firstStudent) {
    return true // Empty is compatible with both
  }

  return "isTeamMember" in firstStudent && !("memberType" in firstStudent) && !("referrer" in firstStudent)
}

export function migrateLegacyData(legacy: LegacyData): StorageData {
  console.log("[v0] Legacy data migration - teacherCosts count:", legacy.teacherCosts?.length || 0)

  return {
    students: legacy.students?.map(migrateLegacyStudent) || [],
    teacherRecords: legacy.teacherCosts || [],
    expenses: legacy.expenses || [],
    bonusRules: legacy.bonusRules || [],
    teachers: legacy.teachers || [],
    initialBalance: legacy.initialBalance || 0,
    presetData: legacy.coursePresets || {},
  }
}

export function migrateData(data: any): StorageData {
  if (isLegacyData(data)) {
    console.log("[v0] Migrating legacy data format to new format")
    return migrateLegacyData(data)
  }

  const teacherRecords = data.teacherRecords || data.teacherCosts || []
  console.log("[v0] Loading existing data - teacherRecords count:", teacherRecords.length)

  // Already in new format, just ensure all fields exist
  return {
    students: data.students || [],
    teacherRecords: teacherRecords,
    expenses: data.expenses || [],
    bonusRules: data.bonusRules || [],
    teachers: data.teachers || [],
    initialBalance: data.initialBalance || 0,
    presetData: data.presetData || data.coursePresets || {},
  }
}
