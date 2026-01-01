# 财务作战系统 - Next.js 重构版

这是将原 HTML 单文件应用重构为 Next.js 应用的版本。

## 架构改进

### 1. **类型安全**
- 使用 TypeScript 定义所有数据结构
- 类型定义在 `types/index.ts`

### 2. **模块化**
- 将常量提取到 `lib/constants.ts`
- 工具函数在 `lib/utils/helpers.ts`
- 存储逻辑在 `lib/storage.ts`

### 3. **自定义 Hooks**
- `use-notification.ts` - 通知管理
- `use-finance-data.ts` - 财务数据状态管理

### 4. **组件化**
- 拆分为独立的 React 组件
- 使用 Next.js App Router
- 服务端和客户端组件分离

## 原功能模块

1. **学员录入** - StudentEntry 组件 (待实现)
2. **课消打卡** - StudentLog 组件 (待实现)
3. **教师成本** - TeacherLog 组件 (待实现)
4. **运营杂费** - Expenses 组件 (待实现)
5. **经营驾驶舱** - Dashboard 组件 (待实现)
6. **薪酬分红** - BonusSystem 组件 (待实现)
7. **师资库** - TeacherManager 组件 (待实现)

## 下一步

每个模块都需要从原 HTML 代码迁移为独立的 React 组件。基础架构已经搭建完成,包括:

- ✅ 类型定义
- ✅ 常量和工具函数
- ✅ 数据持久化
- ✅ 通知系统
- ✅ 布局和导航
- ⏳ 各功能模块组件

## 使用说明

1. 数据会自动保存到浏览器 localStorage
2. 可以导出为 JSON 文件备份
3. 可以导入 JSON 文件恢复数据
