"use client"

import { useMemo } from "react"
import { Activity } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import type { Student, TeacherRecord, Expense } from "@/types"
import { EXPENSE_STATUS } from "@/lib/constants"

type DashboardProps = {
  students: Student[]
  teacherRecords: TeacherRecord[]
  expenses: Expense[]
  initialBalance: number
  setInitialBalance: (balance: number) => void
  notify: (message: string, type: "success" | "error" | "info") => void
}

export function Dashboard({
  students,
  teacherRecords,
  expenses,
  initialBalance,
  setInitialBalance,
  notify,
}: DashboardProps) {
  // Calculate total revenue
  const totalRevenue = students.reduce(
    (sum, s) => sum + s.courses.reduce((cSum, c) => cSum + (c.isPaid ? c.totalCost : 0), 0),
    0,
  )

  // Calculate paid expenses and teacher costs
  const paidExpenses = expenses
    .filter((e) => e.status === EXPENSE_STATUS.PAID || e.status === EXPENSE_STATUS.PUBLIC_PAID)
    .reduce((sum, e) => sum + e.amount, 0)

  const paidTeacherCost = teacherRecords
    .filter(
      (r) =>
        r.status === EXPENSE_STATUS.PAID ||
        r.status === EXPENSE_STATUS.PRIVATE_PAID ||
        r.status === EXPENSE_STATUS.PUBLIC_PAID,
    )
    .reduce((sum, r) => sum + r.totalCost, 0)

  const bankBalance = initialBalance + totalRevenue - paidExpenses - paidTeacherCost

  // Calculate payable commissions for Normal members
  const payableCommissions = useMemo(() => {
    return students.reduce((sum, student) => {
      // Only calculate for Normal (普通学员客户) members
      if (student.memberType !== "Normal") return sum

      const groupClassFee = student.courses
        .filter((c) => c.type === "大班课" || c.name.includes("大班"))
        .reduce((courseSum, c) => courseSum + c.totalCost, 0)

      // 大班课总额 × 30% (应付佣金) × 50% (安全线扣除部分)
      return sum + groupClassFee * 0.3 * 0.5
    }, 0)
  }, [students])

  const paidCommissions = expenses
    .filter(
      (e) => e.category === "销售佣金" && (e.status === EXPENSE_STATUS.PAID || e.status === EXPENSE_STATUS.PUBLIC_PAID),
    )
    .reduce((sum, e) => sum + e.amount, 0)

  const halfPaidCommissions = paidCommissions * 0.5

  const unpaidTeacherCost = teacherRecords
    .filter((r) => r.status === EXPENSE_STATUS.PENDING)
    .reduce((sum, r) => sum + r.totalCost, 0)

  // Calculate future teacher liability
  const futureLiability = useMemo(() => {
    let total = 0
    const projectMap: Record<string, number> = {}
    const groupClassMap: Record<string, { remainingHours: number; costRate: number; tag: string }> = {}

    students.forEach((s) => {
      s.courses.forEach((c) => {
        const remainingHours = Math.max(0, c.totalHours - c.attendedHours)
        const tag = c.projectTag || "其他"

        if (c.type === "大班课" || c.name.includes("大班")) {
          const uniqueKey = `${tag}-${c.semester}-${c.name}-${c.teacherName}`

          if (!groupClassMap[uniqueKey]) {
            groupClassMap[uniqueKey] = {
              remainingHours: remainingHours,
              costRate: c.teacherBaseCost || 0,
              tag: tag,
            }
          } else {
            groupClassMap[uniqueKey].remainingHours = Math.max(groupClassMap[uniqueKey].remainingHours, remainingHours)
          }
        } else {
          const futureCost = remainingHours * (c.teacherBaseCost || 0)
          total += futureCost
          if (!projectMap[tag]) projectMap[tag] = 0
          projectMap[tag] += futureCost
        }
      })
    })

    Object.values(groupClassMap).forEach((item) => {
      const groupCost = item.remainingHours * item.costRate
      total += groupCost
      if (!projectMap[item.tag]) projectMap[item.tag] = 0
      projectMap[item.tag] += groupCost
    })

    return { total, projectMap }
  }, [students])

  const totalFutureTeacherCost = unpaidTeacherCost + futureLiability.total

  // Calculate student liabilities
  const studentLiabilities = students.flatMap((s) =>
    s.courses.map((c) => {
      const consumedValue = c.attendedHours * c.hourlyRate
      const remainingValue = c.totalCost - consumedValue
      return {
        name: s.name,
        course: c.name,
        total: c.totalCost,
        consumed: consumedValue,
        remaining: Math.max(0, remainingValue),
      }
    }),
  )

  const totalLiability = studentLiabilities.reduce((sum, i) => sum + i.remaining, 0)

  const pendingReimbursement = teacherRecords
    .filter((r) => r.status === EXPENSE_STATUS.PRIVATE_PAID)
    .reduce((sum, r) => sum + r.totalCost, 0)

  const pendingCommissions = expenses
    .filter((e) => e.category === "销售佣金" && e.status === EXPENSE_STATUS.PENDING)
    .reduce((sum, e) => sum + e.amount, 0)

  const refundReserve = useMemo(() => {
    return students.reduce((sum, student) => {
      // Only calculate for Normal (普通学员客户) members
      if (student.memberType !== "Normal") return sum

      const groupClassFee = student.courses
        .filter((c) => c.type === "大班课" || c.name.includes("大班"))
        .reduce((courseSum, c) => courseSum + c.totalCost, 0)

      // Reserve 50% of group class fees for potential refunds
      return sum + groupClassFee * 0.5
    }, 0)
  }, [students])

  // Calculate true available cash using payable commissions
  const trueAvailableCash = bankBalance - payableCommissions - totalFutureTeacherCost - refundReserve

  // Calculate project P&L
  const projectPnL = useMemo(() => {
    const map: Record<string, { revenue: number; commission: number; incurredCost: number; futureCost: number }> = {}

    students.forEach((s) =>
      s.courses.forEach((c) => {
        const tag = c.projectTag || "其他"
        if (!map[tag]) map[tag] = { revenue: 0, commission: 0, incurredCost: 0, futureCost: 0 }
        map[tag].revenue += c.totalCost
      }),
    )

    expenses.forEach((e) => {
      const tag = e.projectTag || "其他"
      if (!map[tag]) map[tag] = { revenue: 0, commission: 0, incurredCost: 0, futureCost: 0 }

      if (e.category === "销售佣金" || e.category === "学员退费") {
        map[tag].commission += e.amount
      }
    })

    teacherRecords.forEach((r) => {
      const tag = r.projectTag || "其他"
      if (!map[tag]) map[tag] = { revenue: 0, commission: 0, incurredCost: 0, futureCost: 0 }
      map[tag].incurredCost += r.totalCost
    })

    Object.entries(futureLiability.projectMap).forEach(([tag, cost]) => {
      if (!map[tag]) map[tag] = { revenue: 0, commission: 0, incurredCost: 0, futureCost: 0 }
      map[tag].futureCost += cost
    })

    return Object.entries(map)
      .map(([k, v]) => {
        const totalCost = v.incurredCost + v.futureCost
        return {
          name: k,
          ...v,
          totalCost,
          profit: v.revenue - v.commission - totalCost,
        }
      })
      .sort((a, b) => b.profit - a.profit)
  }, [students, expenses, teacherRecords, futureLiability])

  const cashFlowHistory = useMemo(() => {
    const flows: Array<{ date: string; type: string; desc: string; amount: number; direction: "in" | "out" }> = []

    students.forEach((s) => {
      s.courses.forEach((c) => {
        if (c.isPaid && c.paymentDate) {
          flows.push({
            date: c.paymentDate,
            type: "学费收入",
            desc: `${s.name} - ${c.name}`,
            amount: c.totalCost,
            direction: "in",
          })
        }
      })
    })

    expenses.forEach((e) => {
      if (e.status === EXPENSE_STATUS.PAID || e.status === EXPENSE_STATUS.PUBLIC_PAID) {
        flows.push({
          date: e.date,
          type: e.category || "杂费支出",
          desc: e.reason,
          amount: -e.amount,
          direction: "out",
        })
      }
    })

    teacherRecords.forEach((r) => {
      if (r.status === EXPENSE_STATUS.PUBLIC_PAID) {
        flows.push({
          date: r.date,
          type: "课酬发放",
          desc: `${r.teacherName} - ${r.abstract || r.courseName}`,
          amount: -r.totalCost,
          direction: "out",
        })
      }
    })

    return flows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [students, expenses, teacherRecords])

  const courseRevenueAnalysis = useMemo(() => {
    const map: Record<string, { semester: string; courseName: string; students: string[]; totalRevenue: number }> = {}

    students.forEach((s) => {
      s.courses.forEach((c) => {
        const key = `${c.semester}-${c.name}`
        if (!map[key]) {
          map[key] = {
            semester: c.semester,
            courseName: c.name,
            students: [],
            totalRevenue: 0,
          }
        }
        if (!map[key].students.includes(s.name)) {
          map[key].students.push(s.name)
        }
        map[key].totalRevenue += c.totalCost
      })
    })

    return Object.values(map).sort((a, b) => b.totalRevenue - a.totalRevenue)
  }, [students])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6 text-indigo-600" />
          <h2 className="text-2xl font-bold text-gray-800">经营驾驶舱</h2>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded border">
          <Label className="text-xs text-gray-500">初始资金:</Label>
          <Input
            type="number"
            className="w-32 text-right font-bold border-none p-0"
            value={initialBalance}
            onChange={(e) => setInitialBalance(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-blue-500">
          <CardContent className="pt-6">
            <p className="text-xs text-gray-500 font-bold uppercase mb-2">账面余额 (含未报销)</p>
            <h3 className="text-3xl font-bold text-gray-900">¥{bankBalance.toLocaleString()}</h3>
            <p className="text-xs text-gray-400 mt-2">银行卡里当前的钱</p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${trueAvailableCash >= 0 ? "border-green-500" : "border-red-600 bg-red-50"}`}>
          <CardContent className="pt-6">
            <p className="text-xs text-gray-500 font-bold uppercase mb-2">真实可用资金 (安全线)</p>
            <h3 className={`text-3xl font-bold ${trueAvailableCash >= 0 ? "text-green-700" : "text-red-600"}`}>
              ¥{trueAvailableCash.toLocaleString()}
            </h3>
            <p className="text-xs text-gray-500 mt-2">
              已扣除: <span className="font-bold text-purple-500">应付佣金的50%</span>
              (¥{payableCommissions.toLocaleString()}) + <span className="font-bold text-red-500">未来预计课酬</span>
              (¥{totalFutureTeacherCost.toLocaleString()}) +{" "}
              <span className="font-bold text-orange-500">退款准备金</span>
              (¥{refundReserve.toLocaleString()})
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-orange-400">
          <CardContent className="pt-6">
            <p className="text-xs text-gray-500 font-bold uppercase mb-2">私人垫付待报销</p>
            <h3 className="text-3xl font-bold text-orange-600">¥{pendingReimbursement.toLocaleString()}</h3>
            <p className="text-xs text-gray-400 mt-2">等待从公户转出的钱</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Student Liabilities */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">学员课消负债表 (学费维度)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-y-auto max-h-80">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">学员</th>
                    <th className="p-2 text-right">总额</th>
                    <th className="p-2 text-right">已确认</th>
                    <th className="p-2 text-right">剩余 (负债)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {studentLiabilities
                    .filter((i) => i.remaining > 0)
                    .map((i, idx) => (
                      <tr key={idx}>
                        <td className="p-2">
                          <div>{i.name}</div>
                          <div className="text-gray-400">{i.course}</div>
                        </td>
                        <td className="p-2 text-right">{i.total.toLocaleString()}</td>
                        <td className="p-2 text-right text-green-600">{i.consumed.toLocaleString()}</td>
                        <td className="p-2 text-right font-bold text-orange-600">{i.remaining.toLocaleString()}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Project P&L */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">项目毛利表 (全周期预测)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-y-auto max-h-80">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">项目</th>
                    <th className="p-2 text-right">收入</th>
                    <th className="p-2 text-right">佣金/退费</th>
                    <th className="p-2 text-right">总成本</th>
                    <th className="p-2 text-right">净毛利</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {projectPnL.map((p, idx) => (
                    <tr key={idx}>
                      <td className="p-2">
                        <div>{p.name}</div>
                        <div className="text-xs text-gray-400">
                          已发: {p.incurredCost.toLocaleString()} | 待付: {p.futureCost.toLocaleString()}
                        </div>
                      </td>
                      <td className="p-2 text-right text-blue-600">{p.revenue.toLocaleString()}</td>
                      <td className="p-2 text-right text-red-400">{p.commission.toLocaleString()}</td>
                      <td className="p-2 text-right text-red-400 font-medium">{p.totalCost.toLocaleString()}</td>
                      <td className={`p-2 text-right font-bold ${p.profit > 0 ? "text-green-600" : "text-red-600"}`}>
                        {p.profit.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Single-Course Revenue Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">单科营收分析 (按学期+课程聚合)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-y-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="bg-purple-50 text-gray-600 sticky top-0">
                <tr>
                  <th className="p-2 text-left">学期</th>
                  <th className="p-2 text-left">课程名称</th>
                  <th className="p-2 text-right">学生人数</th>
                  <th className="p-2 text-right">累计营收</th>
                  <th className="p-2 text-left">学生名单</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {courseRevenueAnalysis.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-2 text-gray-600">{item.semester}</td>
                    <td className="p-2 font-bold">{item.courseName}</td>
                    <td className="p-2 text-right">
                      <Badge variant="secondary">{item.students.length}人</Badge>
                    </td>
                    <td className="p-2 text-right font-bold text-green-600">¥{item.totalRevenue.toLocaleString()}</td>
                    <td className="p-2 text-xs text-gray-500">{item.students.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Cash Flow History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">资金流水明细账 (自动生成)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-y-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 sticky top-0">
                <tr>
                  <th className="p-2 text-left">日期</th>
                  <th className="p-2 text-left">类型</th>
                  <th className="p-2 text-left">摘要</th>
                  <th className="p-2 text-right">金额</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cashFlowHistory.slice(0, 100).map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-2 text-gray-600">{item.date}</td>
                    <td className="p-2">
                      <Badge
                        variant={item.direction === "in" ? "default" : "secondary"}
                        className={item.direction === "in" ? "bg-green-500" : "bg-red-400"}
                      >
                        {item.type}
                      </Badge>
                    </td>
                    <td className="p-2 text-gray-800">{item.desc}</td>
                    <td
                      className={`p-2 text-right font-bold ${item.direction === "in" ? "text-green-600" : "text-red-600"}`}
                    >
                      {item.amount > 0 ? "+" : ""}
                      {item.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
