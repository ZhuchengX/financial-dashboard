#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
财务系统数据转换脚本
将 Excel 文件转换为 JSON 格式，用于导入到财务系统

功能:
1. 转换课程配置 Excel 为 PresetData
2. 转换现金日记帐为 Expense 记录
3. 匹配学生信息
"""

import json
import pandas as pd
from datetime import datetime
import uuid
import difflib
from typing import Dict, List, Optional, Tuple
import sys
import os

# ============================================================================
# 工具函数
# ============================================================================

def generate_id(prefix: str = "") -> str:
    """生成唯一ID"""
    return f"{prefix}{uuid.uuid4().hex[:9]}"


def extract_names_from_text(text: str) -> List[str]:
    """
    从文本中提取人名
    支持的格式:
    - "付：周淇" -> ["周淇"]
    - "熊泰迪佣金" -> ["熊泰迪"]
    - "王梦洁0.5h主讲 童子璇0.5h协助" -> ["王梦洁", "童子璇"]
    """
    if not text or pd.isna(text):
        return []
    
    text = str(text)
    names = []
    
    # 常见的人名分隔符
    separators = ['、', '，', ',', ' ', '和', '与', '及']
    
    # 分割文本
    parts = [text]
    for sep in separators:
        new_parts = []
        for part in parts:
            new_parts.extend(part.split(sep))
        parts = new_parts
    
    # 提取可能的人名（2-4个汉字）
    for part in parts:
        part = part.strip()
        # 移除数字和特殊字符
        cleaned = ''.join(c for c in part if '\u4e00' <= c <= '\u9fff')
        if 2 <= len(cleaned) <= 4:
            names.append(cleaned)
    
    return list(set(names))  # 去重


def find_similar_name(name: str, students: List[Dict], threshold: float = 0.6) -> Optional[Dict]:
    """
    使用相似度算法匹配学生名字
    返回最相似的学生，如果相似度低于阈值则返回 None
    """
    if not students:
        return None
    
    best_match = None
    best_score = 0
    
    for student in students:
        student_name = student.get('name', '')
        # 计算相似度
        score = difflib.SequenceMatcher(None, name, student_name).ratio()
        if score > best_score:
            best_score = score
            best_match = student
    
    return best_match if best_score >= threshold else None


def match_student(name: str, existing_students: List[Dict]) -> Optional[Dict]:
    """
    匹配学生的完整逻辑
    1. 完全匹配
    2. 包含匹配
    3. 相似度匹配
    """
    if not name or not existing_students:
        return None
    
    name = name.strip()
    
    # 1. 完全匹配
    for student in existing_students:
        if student.get('name') == name:
            return student
    
    # 2. 包含匹配
    for student in existing_students:
        student_name = student.get('name', '')
        if name in student_name or student_name in name:
            return student
    
    # 3. 相似度匹配
    return find_similar_name(name, existing_students, threshold=0.7)


# ============================================================================
# 数据转换函数
# ============================================================================

def convert_course_config(excel_path: str) -> Dict:
    """
    转换课程配置 Excel 为 PresetData 结构
    
    返回格式:
    {
        "专业名称": {
            "年级": {
                "学期": [
                    {
                        "name": "课程名称",
                        "type": "课程类型",
                        "hours": 总课时,
                        "rate": 单价,
                        "defaultTeacher": "默认老师",
                        "defaultCost": 默认课酬
                    },
                    ...
                ]
            }
        }
    }
    """
    print("开始转换课程配置...")
    result = {}
    
    try:
        xls = pd.ExcelFile(excel_path)
        sheet_names = xls.sheet_names
        print(f"  找到 {len(sheet_names)} 个 Sheet: {sheet_names}")
        
        for sheet_name in sheet_names:
            print(f"  处理 Sheet: {sheet_name}")
            df = pd.read_excel(excel_path, sheet_name=sheet_name)
            
            if df.empty:
                print(f"    ⚠ {sheet_name} 为空，跳过")
                continue
            
            row_count = 0
            for _, row in df.iterrows():
                try:
                    major = str(row.get('专业', '')).strip()
                    grade = str(row.get('年级', '')).strip()
                    semester = str(row.get('学期', '')).strip()
                    course_name = str(row.get('课程名称', '')).strip()
                    course_type = str(row.get('课程类型', '')).strip()
                    
                    # 跳过空行
                    if not all([major, grade, semester, course_name]):
                        continue
                    
                    # 初始化嵌套字典
                    if major not in result:
                        result[major] = {}
                    if grade not in result[major]:
                        result[major][grade] = {}
                    if semester not in result[major][grade]:
                        result[major][grade][semester] = []
                    
                    # 构建课程对象
                    course = {
                        'name': course_name,
                        'type': course_type,
                        'hours': int(row.get('总课时', 0)) if pd.notna(row.get('总课时')) else 0,
                        'rate': float(row.get('单价', 0)) if pd.notna(row.get('单价')) else 0,
                        'defaultTeacher': str(row.get('默认老师', '')).strip() or None,
                        'defaultCost': float(row.get('默认课酬', 0)) if pd.notna(row.get('默认课酬')) else None
                    }
                    
                    result[major][grade][semester].append(course)
                    row_count += 1
                    
                except Exception as e:
                    print(f"    ⚠ 处理行时出错: {e}")
                    continue
            
            print(f"    ✓ 处理了 {row_count} 条课程记录")
        
        print(f"✓ 课程配置转换完成，共 {sum(len(g) for m in result.values() for g in m.values())} 条记录")
        return result
        
    except Exception as e:
        print(f"✗ 课程配置转换失败: {e}")
        return {}


def convert_cash_ledger(
    excel_path: str,
    existing_students: List[Dict],
    sheet_name: str = '现金日记帐'
) -> List[Dict]:
    """
    转换现金日记帐为 Expense 记录
    
    参数:
    - excel_path: Excel 文件路径
    - existing_students: 现有学生列表（用于匹配）
    - sheet_name: Sheet 名称
    
    返回: Expense 记录列表
    """
    print(f"开始转换现金日记帐...")
    expenses = []
    
    try:
        # 读取 Excel，跳过前3行（标题和空行）
        df = pd.read_excel(excel_path, sheet_name=sheet_name, header=3)
        
        print(f"  读取了 {len(df)} 行数据")
        
        for idx, row in df.iterrows():
            try:
                # 跳过空行
                if pd.isna(row.get('日期')):
                    continue
                
                # 提取字段
                date_val = row.get('日期')
                payee = str(row.get('收款人', '')).strip() or '未知'
                major = str(row.get('专业名称', '')).strip() or ''
                course = str(row.get('课程名称', '')).strip() or ''
                hours = row.get('课时数量', '')
                summary = str(row.get('摘要', '')).strip()
                attached_course = str(row.get('挂靠课程', '')).strip() or ''
                income = row.get('收入金额', 0)
                expense = row.get('支出金额 ', 0)
                balance = row.get('余额')
                handler = str(row.get('经手人', '')).strip() or ''
                account = str(row.get('支付方式', '')).strip() or ''
                note = str(row.get('备注', '')).strip() or ''
                
                # 计算净金额
                amount = 0
                if pd.notna(income) and income != 0:
                    amount = float(income)
                elif pd.notna(expense) and expense != 0:
                    amount = -float(expense)
                else:
                    continue  # 跳过金额为0的记录
                
                # 跳过汇总行
                if '合计' in summary or '余额' in summary:
                    continue
                
                # 提取人名并匹配学生
                names = extract_names_from_text(summary)
                matched_student = None
                for name in names:
                    matched_student = match_student(name, existing_students)
                    if matched_student:
                        break
                
                # 构建 Expense 对象
                expense_obj = {
                    'id': generate_id('exp_'),
                    'date': date_val.strftime('%Y-%m-%d') if hasattr(date_val, 'strftime') else str(date_val),
                    'payee': payee,
                    'reason': summary,
                    'amount': round(amount, 2),
                    'category': '课程收入' if amount > 0 else '运营支出',
                    'account': account,
                    'status': 'completed',
                    'projectTag': major or '',
                    'linkStudentId': matched_student['id'] if matched_student else None,
                    'handler': handler
                }
                
                # 添加额外信息到备注
                extra_info = []
                if course:
                    extra_info.append(f"课程: {course}")
                if hours and pd.notna(hours):
                    extra_info.append(f"课时: {hours}")
                if attached_course:
                    extra_info.append(f"挂靠: {attached_course}")
                if note:
                    extra_info.append(f"备注: {note}")
                
                if extra_info:
                    expense_obj['reason'] = expense_obj['reason'] + ' | ' + ' | '.join(extra_info)
                
                # 如果匹配到学生，记录匹配信息
                if matched_student:
                    print(f"  ✓ 匹配学生: '{summary}' -> {matched_student['name']}")
                
                expenses.append(expense_obj)
                
            except Exception as e:
                print(f"  ⚠ 处理第 {idx+4} 行时出错: {e}")
                continue
        
        print(f"✓ 现金日记帐转换完成，共 {len(expenses)} 条记录")
        return expenses
        
    except Exception as e:
        print(f"✗ 现金日记帐转换失败: {e}")
        return []


# ============================================================================
# 主函数
# ============================================================================

def main():
    """主函数"""
    print("=" * 70)
    print("财务系统数据转换工具")
    print("=" * 70)
    
    # 文件路径
    course_config_path = '课程配置（汇总）.xlsx'
    cash_ledger_path = '现金收支表(公帐).xlsx'
    finance_data_path = 'finance_data_2025-12-29(14).json'
    output_path = 'converted_data.json'
    
    # 检查文件是否存在
    for path in [course_config_path, cash_ledger_path, finance_data_path]:
        if not os.path.exists(path):
            print(f"✗ 文件不存在: {path}")
            return False
    
    print("\n[1/3] 加载现有财务数据...")
    try:
        with open(finance_data_path, 'r', encoding='utf-8') as f:
            existing_data = json.load(f)
        existing_students = existing_data.get('students', [])
        print(f"✓ 加载了 {len(existing_students)} 个学生记录")
    except Exception as e:
        print(f"✗ 加载失败: {e}")
        return False
    
    print("\n[2/3] 转换课程配置...")
    preset_data = convert_course_config(course_config_path)
    
    print("\n[3/3] 转换现金日记帐...")
    expenses = convert_cash_ledger(cash_ledger_path, existing_students)
    
    # 构建输出数据
    output_data = {
        'presetData': preset_data,
        'expenses': expenses,
        'timestamp': datetime.now().isoformat(),
        'summary': {
            'courses': sum(len(g) for m in preset_data.values() for g in m.values()),
            'expenses': len(expenses),
            'matched_students': sum(1 for e in expenses if e.get('linkStudentId'))
        }
    }
    
    # 保存输出
    print("\n" + "=" * 70)
    print("保存转换结果...")
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        print(f"✓ 数据已保存到: {output_path}")
    except Exception as e:
        print(f"✗ 保存失败: {e}")
        return False
    
    # 打印统计信息
    print("\n" + "=" * 70)
    print("转换统计:")
    print(f"  课程配置: {output_data['summary']['courses']} 条")
    print(f"  现金记录: {output_data['summary']['expenses']} 条")
    print(f"  学生匹配: {output_data['summary']['matched_students']} 条")
    print("=" * 70)
    
    return True


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
