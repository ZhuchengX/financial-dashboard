"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertCircle, DollarSign, TrendingUp } from "lucide-react"
import type { Student } from "@/types"

type StudentFinancialSummaryProps = {
  students: Student[]
  setStudents: (students: Student[]) => void
  markDirty: () => void
}

export function StudentFinancialSummary({ students, setStudents, markDirty }: StudentFinancialSummaryProps) {
  const togglePaymentStatus = (studentId: string) => {
    const updatedStudents = students.map((student) => {
      if (student.id === studentId) {
        const newIsPaid = !student.courses.every((c) => c.isPaid)
        return {
          ...student,
          courses: student.courses.map((course) => ({
            ...course,
            isPaid: newIsPaid,
          })),
        }
      }
      return student
    })
    setStudents(updatedStudents)
    markDirty()
  }

  const studentSummaries = useMemo(() => {
    return students.map((student) => {
      let groupClassHours = 0
      let groupClassFee = 0
      let qaClassHours = 0
      let qaClassFee = 0

      student.courses.forEach((course) => {
        const isGroupClass = course.type === "大班课" || course.name.includes("大班")

        if (isGroupClass) {
          groupClassHours += course.totalHours
          groupClassFee += course.totalCost
        } else {
          qaClassHours += course.totalHours
          qaClassFee += course.totalCost
        }
      })

      const totalFee = groupClassFee + qaClassFee
      const isPaid = student.courses.every((c) => c.isPaid)

      return {
        id: student.id,
        name: student.name,
        grade: student.grade,
        major: student.major,
        memberType: student.memberType,
        groupClassHours,
        groupClassFee,
        qaClassHours,
        qaClassFee,
        totalFee,
        isPaid,
      }
    })
  }, [students])

  const metrics = useMemo(() => {
    const totalRevenue = studentSummaries.reduce((sum, s) => sum + (s.isPaid ? s.totalFee : 0), 0)
    const pendingRevenue = studentSummaries.reduce((sum, s) => sum + (s.isPaid ? 0 : s.totalFee), 0)

    // Calculate refund reserve (50% of group class fees for Normal members only)
    const refundReserve = studentSummaries.reduce((sum, s) => {
      if (s.memberType === "Normal" && s.isPaid) {
        return sum + s.groupClassFee * 0.5
      }
      return sum
    }, 0)

    return {
      totalRevenue,
      pendingRevenue,
      refundReserve,
      totalStudents: studentSummaries.length,
      paidStudents: studentSummaries.filter((s) => s.isPaid).length,
    }
  }, [studentSummaries])

  return (
    <div className="space-y-6">
      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-green-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              <p className="text-xs text-gray-500 font-bold">已收学费</p>
            </div>
            <h3 className="text-2xl font-bold text-green-700 mt-2">¥{metrics.totalRevenue.toLocaleString()}</h3>
            <p className="text-xs text-gray-500 mt-1">
              {metrics.paidStudents}/{metrics.totalStudents} 位学员已付款
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-orange-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-600" />
              <p className="text-xs text-gray-500 font-bold">待收学费</p>
            </div>
            <h3 className="text-2xl font-bold text-orange-700 mt-2">¥{metrics.pendingRevenue.toLocaleString()}</h3>
            <p className="text-xs text-gray-500 mt-1">{metrics.totalStudents - metrics.paidStudents} 位学员未付款</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-red-600" />
              <p className="text-xs text-gray-500 font-bold">退款准备金</p>
            </div>
            <h3 className="text-2xl font-bold text-red-700 mt-2">¥{metrics.refundReserve.toLocaleString()}</h3>
            <p className="text-xs text-gray-500 mt-1">普通客户大班课50%预留</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-600" />
              <p className="text-xs text-gray-500 font-bold">实际可用</p>
            </div>
            <h3 className="text-2xl font-bold text-blue-700 mt-2">
              ¥{(metrics.totalRevenue - metrics.refundReserve).toLocaleString()}
            </h3>
            <p className="text-xs text-gray-500 mt-1">已收 - 退款准备金</p>
          </CardContent>
        </Card>
      </div>

      {/* Student Financial Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>学员客户财务汇总</CardTitle>
          <CardDescription>各学员的大班课、答疑课费用明细及付款状态</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left font-medium text-gray-600">学员姓名</th>
                  <th className="p-3 text-left font-medium text-gray-600">年级/专业</th>
                  <th className="p-3 text-left font-medium text-gray-600">身份</th>
                  <th className="p-3 text-right font-medium text-gray-600">大班课课时</th>
                  <th className="p-3 text-right font-medium text-gray-600">大班课费用</th>
                  <th className="p-3 text-right font-medium text-gray-600">答疑课课时</th>
                  <th className="p-3 text-right font-medium text-gray-600">答疑课费用</th>
                  <th className="p-3 text-right font-bold text-gray-900">总费用</th>
                  <th className="p-3 text-center font-medium text-gray-600">付款状态</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {studentSummaries.map((summary) => (
                  <tr key={summary.id} className="hover:bg-gray-50">
                    <td className="p-3 font-medium">{summary.name}</td>
                    <td className="p-3 text-gray-600">
                      {summary.grade} / {summary.major.slice(0, 2)}...
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={summary.memberType === "Core" ? "default" : "secondary"}
                        className={
                          summary.memberType === "Core"
                            ? "bg-purple-500"
                            : summary.memberType === "Base"
                              ? "bg-blue-500"
                              : "bg-gray-400"
                        }
                      >
                        {summary.memberType === "Core"
                          ? "团队核心成员"
                          : summary.memberType === "Base"
                            ? "团队基础成员"
                            : "普通学员客户"}
                      </Badge>
                    </td>
                    <td className="p-3 text-right text-blue-600">{summary.groupClassHours.toFixed(2)} 课时</td>
                    <td className="p-3 text-right text-blue-700 font-medium">
                      ¥{summary.groupClassFee.toLocaleString()}
                    </td>
                    <td className="p-3 text-right text-orange-600">{summary.qaClassHours.toFixed(2)} 课时</td>
                    <td className="p-3 text-right text-orange-700 font-medium">
                      ¥{summary.qaClassFee.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-bold text-gray-900">¥{summary.totalFee.toLocaleString()}</td>
                    <td className="p-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePaymentStatus(summary.id)}
                        className="h-7 px-3"
                      >
                        {summary.isPaid ? (
                          <Badge className="bg-green-500 hover:bg-green-600">已付款</Badge>
                        ) : (
                          <Badge variant="destructive" className="hover:bg-red-600">
                            未付款
                          </Badge>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Refund Policy Explanation */}
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <div className="font-medium text-orange-900">退款准备金说明</div>
              <div className="text-sm text-orange-800 space-y-1">
                <div>• 针对普通学员客户承诺：根据最终成绩，最多退款50%大班课费用</div>
                <div>• 退款准备金 = 所有普通学员客户的大班课费用总和 × 50%</div>
                <div>• 真实可用资金需从账面余额中扣除此准备金，确保资金安全</div>
                <div>• 团队核心成员和基础成员不享受退款政策，无需预留</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
