"use client"

import { useState, useEffect } from "react"
import { Pencil, Trash2, Save, Edit3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import type { Student, Expense } from "@/types"
import { ACCOUNT_TYPES, EXPENSE_STATUS, SEMESTERS } from "@/lib/constants"
import { generateId, sortStudents } from "@/lib/utils/helpers"

type ExpenseManagerProps = {
  students: Student[]
  expenses: Expense[]
  setExpenses: (expenses: Expense[]) => void
  markDirty: () => void
  notify: (message: string, type: "success" | "error" | "info") => void
}

export function ExpenseManager({ students, expenses, setExpenses, markDirty, notify }: ExpenseManagerProps) {
  const [form, setForm] = useState({
    payee: "",
    reason: "",
    amount: 0,
    category: "行政办公",
    account: ACCOUNT_TYPES.RESERVE,
    status: EXPENSE_STATUS.PAID,
    projectTag: "公共费用",
    date: new Date().toISOString().split("T")[0],
    linkStudentId: "",
    linkSemester: "",
  })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<{ id: string; field: string; value: string } | null>(null)

  // Auto-format reason when student/semester changes
  useEffect(() => {
    if (form.linkStudentId) {
      const s = students.find((std) => std.id === form.linkStudentId)
      if (s) {
        const sem = form.linkSemester || "学期未定"
        const prefix = `[${s.name} | ${s.grade} | ${s.major} | ${sem}]`

        setForm((prev) => {
          if (!prev.reason || prev.reason.startsWith("[")) {
            return { ...prev, reason: prefix + " " }
          }
          return prev
        })
      }
    }
  }, [form.linkStudentId, form.linkSemester, students])

  const addExpense = () => {
    if (!form.payee || !form.amount) {
      notify("请填写收款人/经办人和金额", "error")
      return
    }

    const { linkStudentId, linkSemester, ...finalData } = form

    if (editingId) {
      setExpenses(expenses.map((e) => (e.id === editingId ? { ...e, ...finalData } : e)))
      notify("记录修改成功", "success")
      setEditingId(null)
    } else {
      setExpenses([...expenses, { id: generateId(), ...finalData }])
      notify("记账成功", "success")
    }

    markDirty()
    setForm({
      ...form,
      payee: "",
      reason: "",
      amount: 0,
      linkStudentId: "",
      linkSemester: "",
      date: new Date().toISOString().split("T")[0],
    })
  }

  const handleEdit = (expense: Expense) => {
    setForm({
      ...expense,
      linkStudentId: "",
      linkSemester: "",
    })
    setEditingId(expense.id)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleDelete = (id: string) => {
    if (window.confirm("确定要删除这条记录吗？")) {
      setExpenses(expenses.filter((e) => e.id !== id))
      markDirty()
      notify("记录已删除", "success")
    }
  }

  const handleUpdateField = (id: string, field: string, value: string) => {
    const updatedExpenses = expenses.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    setExpenses(updatedExpenses)
    markDirty()
    setEditingField(null)
    notify("记录已更新", "success")
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>运营杂费录入</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Student Link Helper */}
          <div className="bg-blue-50 p-3 rounded border border-blue-100">
            <div className="text-xs font-bold text-blue-600 mb-2">费用归属辅助生成 (可选)</div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.linkStudentId} onValueChange={(value) => setForm({ ...form, linkStudentId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="关联学员" />
                </SelectTrigger>
                <SelectContent>
                  {sortStudents(students).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.grade})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={form.linkSemester} onValueChange={(value) => setForm({ ...form, linkSemester: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="关联学期" />
                </SelectTrigger>
                <SelectContent>
                  {SEMESTERS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Main Form */}
          <div
            className={`p-4 rounded space-y-4 ${editingId ? "bg-orange-50 border border-orange-200" : "bg-gray-50"}`}
          >
            {editingId && <div className="text-xs font-bold text-orange-600">正在修改记录...</div>}

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>发生日期</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label>摘要 (已自动格式化)</Label>
                <Input
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="例如：购买打印纸"
                  className="font-bold text-gray-700"
                />
              </div>

              <div className="space-y-2">
                <Label>经办人/收款方</Label>
                <Input
                  value={form.payee}
                  onChange={(e) => setForm({ ...form, payee: e.target.value })}
                  placeholder="谁花的钱"
                />
              </div>

              <div className="space-y-2">
                <Label>类别</Label>
                <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="行政办公">行政办公</SelectItem>
                    <SelectItem value="软件订阅">软件订阅</SelectItem>
                    <SelectItem value="差旅交通">差旅交通</SelectItem>
                    <SelectItem value="营销推广">营销推广</SelectItem>
                    <SelectItem value="其他">其他</SelectItem>
                    <SelectItem value="销售佣金">销售佣金</SelectItem>
                    <SelectItem value="学员退费">学员退费</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>金额</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label className="text-blue-600 font-bold">支付方式 (是否垫付)</Label>
                <Select value={form.account} onValueChange={(value) => setForm({ ...form, account: value })}>
                  <SelectTrigger className="border-blue-300 bg-blue-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ACCOUNT_TYPES.PRIVATE}>个人垫付 (需报销)</SelectItem>
                    <SelectItem value={ACCOUNT_TYPES.RESERVE}>公账/备用金 (无需报销)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2 flex items-end gap-2">
                {editingId && (
                  <Button
                    onClick={() => {
                      setEditingId(null)
                      setForm({
                        ...form,
                        payee: "",
                        reason: "",
                        amount: 0,
                        date: new Date().toISOString().split("T")[0],
                      })
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    取消
                  </Button>
                )}
                <Button
                  onClick={addExpense}
                  className={`flex-1 ${editingId ? "bg-orange-600 hover:bg-orange-700" : "bg-blue-600 hover:bg-blue-700"}`}
                >
                  {editingId ? "保存修改" : "记一笔"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expense List */}
      <Card>
        <CardHeader>
          <CardTitle>费用记录列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-orange-50 text-xs uppercase text-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left">日期</th>
                  <th className="px-4 py-2 text-left">摘要</th>
                  <th className="px-4 py-2 text-left">经办人</th>
                  <th className="px-4 py-2 text-right">金额</th>
                  <th className="px-4 py-2 text-left">支付方式</th>
                  <th className="px-4 py-2 text-left">状态</th>
                  <th className="px-4 py-2 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {expenses
                  .slice()
                  .reverse()
                  .slice(0, 50)
                  .map((e) => (
                    <tr key={e.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">
                        {editingField?.id === e.id && editingField?.field === "date" ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="date"
                              value={editingField.value}
                              onChange={(ev) => setEditingField({ ...editingField, value: ev.target.value })}
                              className="h-7 w-28 text-xs"
                            />
                            <Button
                              onClick={() => handleUpdateField(e.id, "date", editingField.value)}
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                            >
                              <Save className="w-3 h-3 text-green-600" />
                            </Button>
                          </div>
                        ) : (
                          <div
                            className="flex items-center gap-1 group cursor-pointer"
                            onClick={() => setEditingField({ id: e.id, field: "date", value: e.date })}
                          >
                            <span>{e.date}</span>
                            <Edit3 className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs">{e.reason}</td>
                      <td className="px-4 py-2">{e.payee}</td>
                      <td className="px-4 py-2 font-bold text-red-600 text-right">-{e.amount.toLocaleString()}</td>
                      <td className="px-4 py-2 text-xs">{e.account}</td>
                      <td className="px-4 py-2">
                        <Badge
                          variant={e.status === EXPENSE_STATUS.PAID ? "default" : "secondary"}
                          className={
                            e.status === EXPENSE_STATUS.PAID ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          }
                        >
                          {e.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 flex gap-2">
                        <Button onClick={() => handleEdit(e)} variant="ghost" size="sm">
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button onClick={() => handleDelete(e.id)} variant="ghost" size="sm" className="text-red-400">
                          <Trash2 className="w-3 h-3" />
                        </Button>
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
