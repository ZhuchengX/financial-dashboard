"use client"

import { useState, useMemo } from "react"
import { Award, DollarSign, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Student, TeacherRecord, Expense, BonusRule } from "@/types"
import { ACCOUNT_TYPES, EXPENSE_STATUS, INCENTIVE_EVAL, INCENTIVE_SCORE } from "@/lib/constants"
import { generateId } from "@/lib/utils/helpers"

type BonusSystemProps = {
  students: Student[]
  teacherRecords: TeacherRecord[]
  setTeacherRecords: (records: TeacherRecord[]) => void
  expenses: Expense[]
  setExpenses: (expenses: Expense[]) => void
  bonusRules: BonusRule[]
  setBonusRules: (rules: BonusRule[]) => void
  markDirty: () => void
  notify: (message: string, type: "success" | "error" | "info") => void
}

export function BonusSystem({
  students,
  teacherRecords,
  setTeacherRecords,
  expenses,
  setExpenses,
  bonusRules,
  setBonusRules,
  markDirty,
  notify,
}: BonusSystemProps) {
  // Teacher Incentive Settlement
  const [settleTeacher, setSettleTeacher] = useState("")
  const [settleEval, setSettleEval] = useState(0)
  const [settleScore, setSettleScore] = useState(0)
  const [settleRefundRate, setSettleRefundRate] = useState(0)

  // Result Settlement (Student Commission)
  const [resultStudentId, setResultStudentId] = useState("")
  const [resultRefundRate, setResultRefundRate] = useState(0)

  // Profit Share Rules
  const [newRule, setNewRule] = useState({ personName: "", projectTag: "", ratio: 10 })

  // Get all projects
  const allProjects = useMemo(() => {
    const tags = new Set<string>()
    students.forEach((s) => s.courses.forEach((c) => tags.add(c.projectTag || "其他")))
    return Array.from(tags)
  }, [students])

  // Get all people
  const allPeople = useMemo(() => {
    const people = new Set<string>()
    teacherRecords.forEach((r) => people.add(r.teacherName))
    expenses.forEach((e) => people.add(e.payee))
    bonusRules.forEach((r) => people.add(r.personName))
    students.forEach((s) => people.add(s.name))
    return Array.from(people).filter((n) => n)
  }, [teacherRecords, expenses, bonusRules, students])

  // Teacher teaching stats for incentive
  const teachingStats = useMemo(() => {
    if (!settleTeacher) return []
    const stats: Record<string, { course: string; project: string; hours: number }> = {}

    teacherRecords
      .filter((r) => r.teacherName === settleTeacher && !r.isBonusSettlement)
      .forEach((r) => {
        if (r.courseType === "答疑课" || (r.courseName && r.courseName.includes("答疑"))) return

        const key = r.courseName + "|" + r.projectTag
        if (!stats[key]) stats[key] = { course: r.courseName, project: r.projectTag, hours: 0 }
        stats[key].hours += r.attendedHours
      })

    return Object.values(stats)
  }, [settleTeacher, teacherRecords])

  // Handle teacher incentive settlement
  const handleTeacherSettle = (course: { course: string; project: string; hours: number }) => {
    // Refund Rate Impact: 50% refund = 0 bonus, 0% refund = 100% bonus
    const riskFactor = Math.max(0, 1 - settleRefundRate / 50)
    const rawBonus = course.hours * (settleEval + settleScore)
    const finalBonus = rawBonus * riskFactor

    if (finalBonus <= 0 && rawBonus > 0) {
      notify(`由于退费率高达${settleRefundRate}%，计算出的奖金为0，无法生成。`, "error")
      return
    }
    if (rawBonus <= 0) {
      notify("基础奖金必须大于0", "error")
      return
    }

    const newRecord: TeacherRecord = {
      id: generateId(),
      teacherName: settleTeacher,
      courseName: course.course,
      courseType: "大班课",
      projectTag: course.project,
      gradSchool: "",
      majorRank: "",
      baseTierIndex: 0,
      evalBonus: 0,
      scoreBonus: 0,
      baseHourlyCost: 0,
      performanceCost: finalBonus,
      attendedHours: 0,
      totalCost: finalBonus,
      date: new Date().toISOString().split("T")[0],
      account: ACCOUNT_TYPES.PAYROLL,
      status: EXPENSE_STATUS.PENDING,
      handler: "系统自动",
      payee: settleTeacher,
      infoUpdateTime: new Date().toISOString().split("T")[0],
      isBonusSettlement: true,
      abstract: `期末激励结算：${course.course} (${course.hours}课时) - 退费率${settleRefundRate}%`,
    }

    setTeacherRecords([...teacherRecords, newRecord])
    markDirty()
    notify(`结算成功！已生成 ¥${finalBonus.toFixed(0)} 的奖金单 (原额: ¥${rawBonus.toFixed(0)})`, "success")
  }

  // Result stats for student commission settlement
  const resultStats = useMemo(() => {
    if (!resultStudentId) return null
    const student = students.find((s) => s.id === resultStudentId)
    if (!student) return null

    const isTeamMember = student.memberType === "Core" || student.memberType === "Base"

    // Calculate total group class tuition (refund basis)
    const totalGroupTuition = student.courses
      .filter((c) => c.type === "大班课" || c.name.includes("大班"))
      .reduce((sum, c) => sum + c.totalCost, 0)

    // Effective refund rate (team members have 0)
    const effectiveRefundRate = isTeamMember ? 0 : resultRefundRate

    // Refund amount
    const refundAmount = totalGroupTuition * (effectiveRefundRate / 100)

    // Find pending commissions
    const targetExpenses = expenses.filter(
      (e) =>
        e.category === "销售佣金" &&
        e.status === EXPENSE_STATUS.PENDING &&
        e.reason.includes(student.name) &&
        (e.reason.includes("尾") || e.reason.includes("待结") || (isTeamMember && e.reason.includes("全额"))),
    )

    const pendingCommissionTotal = targetExpenses.reduce((sum, e) => sum + e.amount, 0)

    // Payout factor
    let payoutFactor = 0
    if (isTeamMember) {
      payoutFactor = 1
    } else {
      payoutFactor = Math.max(0, (50 - effectiveRefundRate) / 50)
    }

    const finalCommission = pendingCommissionTotal * payoutFactor
    const cancelledCommission = pendingCommissionTotal - finalCommission

    return {
      isTeamMember,
      totalGroupTuition,
      refundAmount,
      effectiveRefundRate,
      pendingCommissionTotal,
      finalCommission,
      cancelledCommission,
      targetCount: targetExpenses.length,
    }
  }, [resultStudentId, resultRefundRate, students, expenses])

  // Handle result settlement
  const handleResultSettlement = () => {
    if (!resultStats) return

    const student = students.find((s) => s.id === resultStudentId)
    if (!student) return

    const newExpenses = [...expenses]

    // 1. Generate refund expense
    if (resultStats.refundAmount > 0) {
      newExpenses.push({
        id: generateId(),
        date: new Date().toISOString().split("T")[0],
        category: "学员退费",
        reason: `对赌退费: ${student.name} (退率${resultStats.effectiveRefundRate}%)`,
        amount: resultStats.refundAmount,
        account: ACCOUNT_TYPES.RESERVE,
        status: EXPENSE_STATUS.PAID,
        payee: student.name,
        projectTag: student.major || "退费支出",
      })
    }

    // 2. Update pending commissions
    const updatedExpenses = newExpenses.map((e) => {
      if (e.category === "销售佣金" && e.status === EXPENSE_STATUS.PENDING && e.reason.includes(student.name)) {
        const isTail = e.reason.includes("尾") || e.reason.includes("待结")
        const isFull = resultStats.isTeamMember && e.reason.includes("全额")

        if (isTail || isFull) {
          const payoutFactor = resultStats.isTeamMember ? 1 : Math.max(0, (50 - resultStats.effectiveRefundRate) / 50)
          const finalAmt = e.amount * payoutFactor
          const cancelledAmt = e.amount - finalAmt

          // Update reason to show settlement
          const newReason = e.reason.replace("尾", "尾已结").replace("待结", "已结").replace("全额", "全额已结")

          return {
            ...e,
            amount: finalAmt,
            reason: `${newReason}（对赌率${resultStats.effectiveRefundRate}%，扣除¥${cancelledAmt.toFixed(0)}）`,
            status: EXPENSE_STATUS.PAID,
          }
        }
      }
      return e
    })

    setExpenses(updatedExpenses)
    markDirty()
    notify(
      `对赌结算成功！退费支出 ¥${resultStats.refundAmount.toFixed(0)}，佣金实付 ¥${resultStats.finalCommission.toFixed(0)}，扣除 ¥${resultStats.cancelledCommission.toFixed(0)}。`,
      "success",
    )
    setResultStudentId("")
    setResultRefundRate(0)
  }

  // Profit share rule management
  const handleAddRule = () => {
    if (!newRule.personName || !newRule.projectTag) {
      notify("请填写完整规则", "error")
      return
    }
    setBonusRules([...bonusRules, { id: generateId(), ...newRule, type: "profit_share" }])
    markDirty()
    setNewRule({ ...newRule, personName: "" })
    notify("分红规则已添加", "success")
  }

  const handleDeleteRule = (id: string) => {
    setBonusRules(bonusRules.filter((r) => r.id !== id))
    markDirty()
    notify("规则已删除", "info")
  }

  // Teacher who taught this semester
  const teachersWhoTaught = useMemo(() => {
    const teacherNames = new Set<string>()
    console.log("[v0] Total teacher records:", teacherRecords.length)
    const validRecords = teacherRecords.filter((r) => !r.isBonusSettlement && r.attendedHours > 0)
    console.log("[v0] Valid teaching records (not bonus, hours > 0):", validRecords.length)
    validRecords.forEach((r) => {
      console.log("[v0] Adding teacher:", r.teacherName, "Hours:", r.attendedHours)
      teacherNames.add(r.teacherName)
    })
    const result = Array.from(teacherNames).sort()
    console.log("[v0] Teachers who taught this semester:", result)
    return result
  }, [teacherRecords])

  // Team profit data calculation
  const teamProfitData = useMemo(() => {
    const map: Record<
      string,
      {
        revenue: number
        teacherCost: number
        expenses: number
        directCommission: number
        gambleFirstCommission: number
        gambleTailCommission: number
      }
    > = {}

    // ... existing calculation code ...

    return Object.entries(map)
      .map(([name, data]) => {
        const netProfit = data.revenue - data.teacherCost - data.expenses
        const totalCommission = data.directCommission + data.gambleFirstCommission + data.gambleTailCommission

        let commissionDisplay = ""
        if (data.gambleFirstCommission > 0 || data.gambleTailCommission > 0) {
          // Non-team member with gamble logic
          const safeAmount = data.gambleFirstCommission
          const riskAmount = data.gambleTailCommission
          commissionDisplay = `¥${safeAmount.toLocaleString()} (¥${riskAmount.toLocaleString()})`
        } else {
          // Team member - direct display
          commissionDisplay = `¥${data.directCommission.toLocaleString()}`
        }

        return {
          name,
          revenue: data.revenue,
          cost: data.teacherCost + data.expenses,
          commission: totalCommission,
          commissionDisplay, // New formatted display
          netProfit,
        }
      })
      .sort((a, b) => b.netProfit - a.netProfit)
  }, [students, teacherRecords, expenses])

  return (
    <div className="space-y-6">
      <Tabs defaultValue="teacher" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="teacher">
            <Award className="w-4 h-4 mr-2" />
            教师激励
          </TabsTrigger>
          <TabsTrigger value="commission">
            <DollarSign className="w-4 h-4 mr-2" />
            佣金对赌
          </TabsTrigger>
          <TabsTrigger value="profit">
            <TrendingUp className="w-4 h-4 mr-2" />
            利润分红
          </TabsTrigger>
        </TabsList>

        {/* Teacher Incentive */}
        <TabsContent value="teacher">
          <Card>
            <CardHeader>
              <CardTitle>教师期末激励结算</CardTitle>
              <p className="text-sm text-gray-500">根据授课时长、教学评估和学员成绩计算绩效奖金</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>选择老师</Label>
                  <Select value={settleTeacher} onValueChange={setSettleTeacher}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择老师" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachersWhoTaught.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>退费率 (%)</Label>
                  <Input
                    type="number"
                    value={settleRefundRate}
                    onChange={(e) => setSettleRefundRate(Number(e.target.value))}
                    placeholder="0-50"
                    min="0"
                    max="50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>教学评估奖金 (¥/课时)</Label>
                  <Select value={String(settleEval)} onValueChange={(v) => setSettleEval(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INCENTIVE_EVAL.map((val) => (
                        <SelectItem key={val} value={String(val)}>
                          ¥{val}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>成绩激励奖金 (¥/课时)</Label>
                  <Select value={String(settleScore)} onValueChange={(v) => setSettleScore(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INCENTIVE_SCORE.map((val) => (
                        <SelectItem key={val} value={String(val)}>
                          ¥{val}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {settleTeacher && teachingStats.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-bold">授课统计（仅大班课）</h4>
                  {teachingStats.map((stat, idx) => {
                    const rawBonus = stat.hours * (settleEval + settleScore)
                    const riskFactor = Math.max(0, 1 - settleRefundRate / 50)
                    const finalBonus = rawBonus * riskFactor

                    return (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                        <div>
                          <div className="font-bold">{stat.course}</div>
                          <div className="text-xs text-gray-500">
                            {stat.project} · {stat.hours.toFixed(2)}课时
                          </div>
                          <div className="text-sm text-blue-600 mt-1">
                            原额 ¥{rawBonus.toFixed(0)} → 实付 ¥{finalBonus.toFixed(0)}
                          </div>
                        </div>
                        <Button onClick={() => handleTeacherSettle(stat)} size="sm">
                          生成奖金单
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commission Settlement */}
        <TabsContent value="commission">
          <Card>
            <CardHeader>
              <CardTitle>销售佣金对赌结算</CardTitle>
              <p className="text-sm text-gray-500">根据学员退费率结算销售人员的尾款佣金</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>选择学员</Label>
                  <Select value={resultStudentId} onValueChange={setResultStudentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择学员" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} - {s.grade} ({s.major})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>退费率 (%)</Label>
                  <Input
                    type="number"
                    value={resultRefundRate}
                    onChange={(e) => setResultRefundRate(Number(e.target.value))}
                    placeholder="0-50"
                    min="0"
                    max="50"
                  />
                </div>
              </div>

              {resultStats && (
                <>
                  <Separator />
                  <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-bold text-blue-900">结算预览</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-gray-600">学员类型</div>
                        <Badge variant={resultStats.isTeamMember ? "default" : "secondary"}>
                          {resultStats.isTeamMember ? "团队成员（0风险）" : "普通学员客户"}
                        </Badge>
                      </div>
                      <div>
                        <div className="text-gray-600">大班课总额</div>
                        <div className="font-bold">¥{resultStats.totalGroupTuition.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">退费支出</div>
                        <div className="font-bold text-red-600">-¥{resultStats.refundAmount.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">待结佣金记录</div>
                        <div className="font-bold">{resultStats.targetCount}条</div>
                      </div>
                      <div>
                        <div className="text-gray-600">原始佣金总额</div>
                        <div className="font-bold">¥{resultStats.pendingCommissionTotal.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">实际支付佣金</div>
                        <div className="font-bold text-green-600">¥{resultStats.finalCommission.toLocaleString()}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-gray-600">扣除佣金</div>
                        <div className="font-bold text-red-600">
                          -¥{resultStats.cancelledCommission.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleResultSettlement} className="w-full" size="lg">
                    确认结算（不可撤销）
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profit Share Rules */}
        <TabsContent value="profit">
          <Card>
            <CardHeader>
              <CardTitle>利润分红规则</CardTitle>
              <p className="text-sm text-gray-500">按项目配置固定分红比例</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>分红人</Label>
                  <Select value={newRule.personName} onValueChange={(v) => setNewRule({ ...newRule, personName: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择人员" />
                    </SelectTrigger>
                    <SelectContent>
                      {allPeople.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>项目</Label>
                  <Select value={newRule.projectTag} onValueChange={(v) => setNewRule({ ...newRule, projectTag: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择项目" />
                    </SelectTrigger>
                    <SelectContent>
                      {allProjects.map((tag) => (
                        <SelectItem key={tag} value={tag}>
                          {tag}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>分红比例 (%)</Label>
                  <Input
                    type="number"
                    value={newRule.ratio}
                    onChange={(e) => setNewRule({ ...newRule, ratio: Number(e.target.value) })}
                  />
                </div>
              </div>

              <Button onClick={handleAddRule} className="w-full">
                添加分红规则
              </Button>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-bold">现有规则</h4>
                {bonusRules.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">暂无分红规则</p>
                ) : (
                  bonusRules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <div className="font-bold">{rule.personName}</div>
                        <div className="text-sm text-gray-500">
                          {rule.projectTag} · {rule.ratio}%
                        </div>
                      </div>
                      <Button onClick={() => handleDeleteRule(rule.id)} variant="ghost" size="sm">
                        删除
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
