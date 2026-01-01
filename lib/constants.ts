export const TEACHER_TIERS = [
  { label: "T1 - 清北", base: 1200 },
  { label: "T2 - 华五/中科院(强)", base: 1100 },
  { label: "T3 - 航开济/C9(中)", base: 1000 },
  { label: "T4 - 中坚九校(中)", base: 900 },
  { label: "T5 - 985/211(普)", base: 800 },
  { label: "Wait - 待定/其他", base: 0 },
]

export const SCHOOL_LIST = [
  { name: "清华大学", tier: 0 },
  { name: "北京大学", tier: 0 },
  { name: "复旦大学", tier: 1 },
  { name: "上海交通大学", tier: 1 },
  { name: "浙江大学", tier: 1 },
  { name: "中国科学技术大学", tier: 1 },
  { name: "南京大学", tier: 1 },
  { name: "中科院系统所", tier: 1 },
  { name: "中科院自动化所", tier: 1 },
  { name: "中国人民大学", tier: 2 },
  { name: "西安交通大学", tier: 2 },
  { name: "哈尔滨工业大学", tier: 2 },
  { name: "国防科技大学", tier: 2 },
  { name: "北京航空航天大学", tier: 2 },
  { name: "北京理工大学", tier: 2 },
  { name: "东南大学", tier: 3 },
  { name: "同济大学", tier: 3 },
  { name: "武汉大学", tier: 3 },
  { name: "华中科技大学", tier: 3 },
  { name: "南开大学", tier: 3 },
  { name: "电子科技大学", tier: 3 },
  { name: "西北工业大学", tier: 3 },
  { name: "中山大学", tier: 3 },
  { name: "天津大学", tier: 3 },
  { name: "北京师范大学", tier: 3 },
  { name: "华东师范大学", tier: 3 },
  { name: "中南大学", tier: 4 },
  { name: "华南理工大学", tier: 4 },
  { name: "山东大学", tier: 4 },
  { name: "南方科技大学", tier: 4 },
  { name: "上海科技大学", tier: 4 },
  { name: "中科院其他所", tier: 4 },
  { name: "无 / 出国 / 其他", tier: 5 },
]

export const MAJOR_ORDER = {
  数学与应用数学D: 1,
  交通设备与控制工程D: 2,
  机械制造及其自动化D: 3,
  计算机科学与技术D: 4,
  土木工程D: 5,
}

export const SEMESTER_ORDER_LIST = [
  "第一学年第一学期",
  "第一学年第二学期",
  "第二学年第一学期",
  "第二学年第二学期",
  "第三学年第一学期",
  "第三学年第二学期",
  "第四学年第一学期",
  "第四学年第二学期",
]

export const SEMESTERS = [
  "第一学年第一学期",
  "第一学年第二学期",
  "第二学年第一学期",
  "第二学年第二学期",
  "第三学年第一学期",
  "第三学年第二学期",
  "第四学年第一学期",
  "第四学年第二学期",
]

export const GRADES = ["2022级", "2023级", "2024级", "2025级", "2026级", "2027级"]

export const MAJORS = [
  "数学与应用数学D",
  "交通设备与控制工程D",
  "机械制造及其自动化D",
  "计算机科学与技术D",
  "土木工程D",
]

export const ACCOUNT_TYPES = {
  PUBLIC: "对公账户(只进不出)",
  RESERVE: "运营备用金(王露艺)",
  PAYROLL: "薪资发放账户",
  PRIVATE: "个人垫付(待报销)",
}

export const EXPENSE_STATUS = {
  PAID: "已支付",
  PENDING: "挂账/待付",
  PRIVATE_PAID: "已私付(未走公账)",
  PUBLIC_PAID: "已公付(已走公账)",
}

export const INCENTIVE_EVAL = [0, 50, 100, 150]
export const INCENTIVE_SCORE = [0, 100, 300, 500]

export const DEFAULT_PRESET_DATA = {
  数学与应用数学D: {
    "2024级": {
      第二学年第一学期: [
        {
          name: "数学分析I",
          type: "大班课",
          hours: 48,
          rate: 50,
          defaultTeacher: "李教授",
          defaultCost: 1200,
        },
        {
          name: "数学分析I",
          type: "答疑课",
          hours: 12,
          rate: 500,
          defaultTeacher: "张助教",
          defaultCost: 500,
        },
      ],
    },
  },
}
