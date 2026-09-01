#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
邮满满云仓报价展示网站 —— 数据解析脚本
================================================
扫描数据源文件夹下的报价表文件（.xls / .xlsx / .csv 自动识别），
把每个工作表解析成结构化记录，写入 data/data.js（前端直接 <script> 引入，
兼容 file:// 双击打开，无需 fetch / 服务器）。

特性：
  1. 自动识别文件格式，新增/替换报价表文件后重新运行即可同步，无需改代码。
  2. 每次成功解析都会递增版本号并记录更新时间；写入前先把上一版备份为 data.prev.js。
  3. 解析整体失败时（无文件 / 全部失败 / 异常），保留上一版数据并写入错误状态，
     前端展示“已回退至上一版本”的明确报错横幅。
  4. 单个工作表解析失败不会中断整体，会记入 errors 列表并在前端提示。

用法：
  python parse_prices.py                 # 使用默认数据源目录（../邮满满云仓报价表）
  python parse_prices.py --data-dir DIR  # 指定数据源目录
  python parse_prices.py --out-dir DIR   # 指定输出目录（默认 ./data）
  python parse_prices.py --include-zones # 连庞大的邮编/分区对照表也一并纳入
  python parse_prices.py --force         # 即使无变化也重写（版本号仍递增）
"""

import os
import re
import sys
import csv
import json
import shutil
import datetime
import argparse

# ---------------------------------------------------------------------------
# 配置：分类关键词 / 默认排除规则 / 表头关键词
# ---------------------------------------------------------------------------

# 工作表名命中以下关键词 -> 归类到「云仓服务」
WAREHOUSE_KW = ["云仓", "耗材", "仓储", "代发", "入库", "出库", "操作费", "囤货", "库存"]

# 工作表名命中以下关键词 -> 归类到「线路报价」
ROUTE_KW = ["专线", "快线", "标准", "商派", "挂号", "特惠", "标快", "普货", "特货",
           "带电", "美国", "欧洲", "日本", "东南亚", "云途", "英国", "德国", "法国",
           "MG", "PF", "TF", "平邮", "轻小件", "服装", "化妆品"]

# 工作表名命中以下关键词 -> 归类到「参考规则」（优先级高于线路，避免误判）
REFERENCE_KW = ["药事法", "税率表", "税率", "申报价值", "禁运", "注意事项", "清单",
               "分区表", "偏远", "邮编", "参考", "目录", "售后", "规则", "须知"]

# 默认排除的“庞大地址对照/分区邮编”类工作表（纯查询表，行数万级，纳入会拖慢网页）
DEFAULT_EXCLUDE_RE = re.compile(r"(东南亚分区表|澳大利亚分区邮编|美国偏远邮编地区)", re.IGNORECASE)

# 识别为表头行的关键词（单元格包含其一即算命中表头特征）
HEADER_KW = ["国家", "地区", "邮编", "分区", "重量", "运费", "价格", "挂号", "时效",
             "类目", "品类", "品目", "备注", "申报", "税率", "服务费", "处理费", "尺寸",
             "对接", "走货", "起始", "截止", "附加费", "金额", "单价", "名称", "序号",
             "项目", "服务", "类型", "区域", "省份", "城市", "国家/地区", "参考时效",
             "重量段", "计费重", "进位制", "派送", "最低", "首重", "续重"]

# 货币类列（表头含其一 -> 显示为 ¥）
CURRENCY_KW = ["RMB", "元", "费", "价格", "运费", "挂号", "服务费", "附加费",
               "处理费", "单价", "金额", "成本", "首重", "续重", "保价"]

# 纯目录/返回行标记
TOC_MARKERS = ["返回目录"]

# ---------------------------------------------------------------------------
# 单元格读取辅助
# ---------------------------------------------------------------------------

def _norm_text(v):
    """把单元格值规范为字符串（去首尾空白、合并换行）。"""
    if v is None:
        return ""
    if isinstance(v, float):
        # 整数值去掉 .0
        if v.is_integer():
            return str(int(v))
        return str(v)
    if isinstance(v, (int,)):
        return str(v)
    s = str(v)
    s = s.replace("\r", " ").replace("\n", " ").replace("\t", " ")
    s = re.sub(r"\s+", " ", s).strip()
    # 去掉全角括号（）两侧的空格，统一单位书写：运费 （RMB/KG） -> 运费（RMB/KG）
    s = re.sub(r"\s*([（）()])", r"\1", s)
    s = re.sub(r"([（）()])\s*", r"\1", s)
    return s


def _is_blank(v):
    return v is None or (isinstance(v, str) and v.strip() == "")


# ---------------------------------------------------------------------------
# 工作簿读取：按格式自动选择引擎
# ---------------------------------------------------------------------------

def read_workbook(path):
    """返回 list[ (sheet_name, rows) ]，rows = list[list[原始cell值]]。"""
    ext = os.path.splitext(path)[1].lower()
    if ext in (".xls",):
        return _read_xls(path)
    if ext in (".xlsx", ".xlsm"):
        return _read_xlsx(path)
    if ext in (".csv", ".txt"):
        return _read_csv(path)
    # 其它格式跳过
    return None


def _read_xls(path):
    import xlrd
    out = []
    wb = xlrd.open_workbook(path, on_demand=True, ragged_rows=True)
    for sn in wb.sheet_names():
        ws = wb.sheet_by_name(sn)
        rows = []
        for r in range(ws.nrows):
            cells = ws.row(r)  # 仅在当前行实际存在的单元格
            row = []
            for cell in cells:
                val = cell.value
                # 日期类型转换
                if cell.ctype == xlrd.XL_CELL_DATE:
                    try:
                        t = xlrd.xldate_as_tuple(val, wb.datemode)
                        val = "%04d-%02d-%02d" % (t[0], t[1], t[2])
                    except Exception:
                        pass
                row.append(val)
            rows.append(row)
        out.append((sn, rows))
    wb.release_resources()
    return out


def _read_xlsx(path):
    import openpyxl
    out = []
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    for ws in wb.worksheets:
        rows = []
        for raw in ws.iter_rows(values_only=True):
            row = [("" if v is None else v) for v in raw]
            rows.append(row)
        out.append((ws.title, rows))
    wb.close()
    return out


def _read_csv(path):
    out = []
    with open(path, "r", encoding="utf-8-sig", newline="", errors="replace") as f:
        reader = csv.reader(f)
        rows = [[c for c in row] for row in reader]
    name = os.path.splitext(os.path.basename(path))[0]
    return [(name, rows)]


# ---------------------------------------------------------------------------
# 表头检测 / 列裁剪 / 元信息提取
# ---------------------------------------------------------------------------

def detect_header_row(rows, max_scan=40):
    """返回第一个命中 >=2 个表头关键词的行索引；找不到返回 None。"""
    for i, row in enumerate(rows[:max_scan]):
        hits = 0
        for cell in row:
            s = _norm_text(cell)
            if not s or len(s) > 30:
                continue
            if any(kw in s for kw in HEADER_KW):
                hits += 1
        if hits >= 2:
            return i
    return None


def prune_empty_columns(headers, rows):
    """删除「表头为空 且 列数据稀疏/全空」的列（去除 Excel 合并单元格残留的空白列）。"""
    n = len(headers)
    if not rows:
        return headers, rows
    keep = []
    for c in range(n):
        header_blank = _is_blank(headers[c])
        non_empty = 0
        for row in rows:
            if c < len(row) and not _is_blank(row[c]):
                non_empty += 1
        # 表头为空的列，若非空率 < 50% 视为合并单元格残留空白列并删除
        drop = header_blank and (non_empty == 0 or (non_empty / len(rows) < 0.5))
        if not drop:
            keep.append(c)
    if len(keep) == n:
        return headers, rows
    new_headers = [headers[c] for c in keep]
    new_rows = []
    for row in rows:
        new_rows.append([(row[c] if c < len(row) else "") for c in keep])
    return new_headers, new_rows


def extract_meta(rows):
    """从整表扫描产品代码 / 生效时间等元信息。"""
    meta = {}
    for row in rows:
        for cell in row:
            s = _norm_text(cell)
            if not s:
                continue
            m = re.search(r"产品代码[：:]\s*([A-Za-z0-9\-]+)", s)
            if m and "productCode" not in meta:
                meta["productCode"] = m.group(1).strip()
            m = re.search(r"生效时间[：:]\s*([0-9]{4}-[0-9]{1,2}-[0-9]{1,2}[^\s]*)", s)
            if m and "effectiveDate" not in meta:
                meta["effectiveDate"] = m.group(1).strip()
    return meta


def classify_category(name):
    s = name
    for kw in WAREHOUSE_KW:
        if kw in s:
            return "云仓服务"
    for kw in REFERENCE_KW:
        if kw in s:
            return "参考规则"
    for kw in ROUTE_KW:
        if kw in s:
            return "线路报价"
    return "参考规则"


# ---------------------------------------------------------------------------
# 单工作表 -> 记录
# ---------------------------------------------------------------------------

def sheet_to_record(name, rows, include_zones):
    """把单个工作表解析为 table 或 text 类型记录。"""
    if not rows:
        return None
    # 去掉完全空白的行
    rows = [r for r in rows if any(not _is_blank(c) for c in r)]
    if not rows:
        return None

    hdr_idx = detect_header_row(rows)
    if hdr_idx is not None and hdr_idx + 1 < len(rows):
        # ---- 表格类型 ----
        raw_headers = [_norm_text(c) for c in rows[hdr_idx]]
        data_rows = rows[hdr_idx + 1:]
        # 去掉目录/返回行
        data_rows = [r for r in data_rows
                     if not (len(r) and _norm_text(r[0]) in TOC_MARKERS)]
        if not data_rows:
            # 表头下无数据 -> 退回文本
            return _text_record(name, rows)
        headers, data_rows = prune_empty_columns(raw_headers, data_rows)
        # 对齐长度
        aligned = []
        for r in data_rows:
            if len(r) > len(headers):
                r = r[:len(headers)]
            elif len(r) < len(headers):
                r = r + [""] * (len(headers) - len(r))
            aligned.append([_norm_text(c) for c in r])
        rec = {
            "type": "table",
            "name": name,
            "category": classify_category(name),
            "meta": extract_meta(rows),
            "headers": headers,
            "rows": aligned,
            "rowCount": len(aligned),
        }
        return rec
    else:
        # ---- 文本类型 ----
        return _text_record(name, rows)


def _text_record(name, rows):
    blocks = []
    for r in rows:
        cells = [_norm_text(c) for c in r if not _is_blank(c)]
        if not cells:
            continue
        if cells[0] in TOC_MARKERS:
            continue
        text = "  |  ".join(cells) if len(cells) > 1 else cells[0]
        if text.strip():
            blocks.append(text.strip())
    return {
        "type": "text",
        "name": name,
        "category": classify_category(name),
        "meta": {},
        "blocks": blocks,
    }


# ---------------------------------------------------------------------------
# 顶层构建
# ---------------------------------------------------------------------------

DATA_VAR = "window.YUNMANMAN_DATA"
STATUS_VAR = "window.YUNMANMAN_STATUS"


def _read_old_version(data_js_path):
    try:
        with open(data_js_path, "r", encoding="utf-8") as f:
            txt = f.read()
        m = re.search(r'"?version"?\s*:\s*(\d+)', txt)
        if m:
            return int(m.group(1))
    except Exception:
        pass
    return 0


def build(data_dir, out_dir, include_zones=False):
    """解析数据源目录，写出 data.js / status.js。返回 (ok, info)。"""
    os.makedirs(out_dir, exist_ok=True)
    data_js = os.path.join(out_dir, "data.js")
    status_js = os.path.join(out_dir, "status.js")
    prev_js = os.path.join(out_dir, "data.prev.js")

    # 收集文件
    supported = (".xls", ".xlsx", ".xlsm", ".csv", ".txt")
    files = []
    if os.path.isdir(data_dir):
        for fn in sorted(os.listdir(data_dir)):
            if fn.startswith("~$") or fn.startswith("."):
                continue
            if fn.lower().endswith(supported):
                files.append(os.path.join(data_dir, fn))
    else:
        return False, {"error": "数据源目录不存在：%s" % data_dir}

    if not files:
        return False, {"error": "数据源目录下未找到任何 .xls/.xlsx/.csv 文件：%s" % data_dir}

    sheets = []
    errors = []
    source_files = []
    for fp in files:
        try:
            wb_sheets = read_workbook(fp)
            if wb_sheets is None:
                errors.append({"file": os.path.basename(fp),
                                "error": "不支持的文件格式，已跳过（仅支持 .xls/.xlsx/.csv）"})
                continue
            n_before = len(sheets)
            for sname, srows in wb_sheets:
                # 默认排除庞大地址对照表
                if (not include_zones) and DEFAULT_EXCLUDE_RE.search(sname):
                    continue
                try:
                    rec = sheet_to_record(sname, srows, include_zones)
                    if rec:
                        rec["sourceFile"] = os.path.basename(fp)
                        sheets.append(rec)
                except Exception as e:
                    errors.append({"file": os.path.basename(fp),
                                    "sheet": sname, "error": "工作表解析异常：%s" % e})
            source_files.append({
                "name": os.path.basename(fp),
                "sizeKB": round(os.path.getsize(fp) / 1024, 1),
                "sheets": len(wb_sheets),
            })
        except Exception as e:
            errors.append({"file": os.path.basename(fp), "error": "文件读取失败：%s" % e})

    if not sheets:
        return False, {
            "error": "所有工作表均解析失败或无有效报价表。",
            "errors": errors,
            "files": [f["name"] for f in source_files],
        }

    # 排序：先按分类，再按名称
    cat_order = {"线路报价": 0, "云仓服务": 1, "参考规则": 2}
    sheets.sort(key=lambda s: (cat_order.get(s["category"], 9), s["name"]))

    total_rows = sum(s.get("rowCount", len(s.get("blocks", []))) for s in sheets)
    old_version = _read_old_version(data_js)
    new_version = old_version + 1
    now = datetime.datetime.now()
    updated_at = now.strftime("%Y-%m-%d %H:%M:%S")

    payload = {
        "version": new_version,
        "updatedAt": updated_at,
        "generatedAtISO": now.isoformat(timespec="seconds"),
        "sourceDir": os.path.abspath(data_dir),
        "sourceFiles": source_files,
        "sheetCount": len(sheets),
        "totalRows": total_rows,
        "includeZones": include_zones,
        "sheets": sheets,
    }

    # 写文件：先备份上一版，再写新版
    if os.path.exists(data_js):
        shutil.copyfile(data_js, prev_js)
    data_txt = "%s = %s;\n" % (DATA_VAR, json.dumps(payload, ensure_ascii=False))
    with open(data_js, "w", encoding="utf-8") as f:
        f.write(data_txt)
    status_txt = '%s = %s;\n' % (STATUS_VAR, json.dumps({
        "ok": True,
        "version": new_version,
        "updatedAt": updated_at,
        "sheetCount": len(sheets),
        "errors": errors,
    }, ensure_ascii=False))
    with open(status_js, "w", encoding="utf-8") as f:
        f.write(status_txt)

    return True, {
        "version": new_version,
        "updatedAt": updated_at,
        "sheetCount": len(sheets),
        "totalRows": total_rows,
        "sourceFiles": [f["name"] for f in source_files],
        "warnings": errors,
    }


def write_failure(out_dir, error_info):
    """解析失败时：保留上一版 data.js，写出错误状态。"""
    os.makedirs(out_dir, exist_ok=True)
    status_js = os.path.join(out_dir, "status.js")
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    prev_version = _read_old_version(os.path.join(out_dir, "data.js"))
    status_txt = '%s = %s;\n' % (STATUS_VAR, json.dumps({
        "ok": False,
        "error": error_info.get("error", "未知解析错误"),
        "detail": error_info,
        "fallbackVersion": prev_version,
        "updatedAt": now,
    }, ensure_ascii=False))
    with open(status_js, "w", encoding="utf-8") as f:
        f.write(status_txt)
    # 若从未成功过，写一个空 data.js 让前端能展示错误
    data_js = os.path.join(out_dir, "data.js")
    if not os.path.exists(data_js):
        with open(data_js, "w", encoding="utf-8") as f:
            f.write("%s = {\n" % DATA_VAR)
            f.write('  "version": 0,\n')
            f.write('  "sheets": [],\n')
            f.write('  "sourceFiles": [],\n')
            f.write('  "sheetCount": 0,\n')
            f.write('  "totalRows": 0\n')
            f.write('};\n')


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------

def main():
    here = os.path.dirname(os.path.abspath(__file__))
    # CI / 自包含仓库：优先用脚本同级的 quotes/ 目录；否则回退到本地默认的 ../邮满满云仓报价表
    default_data = os.path.join(here, "quotes")
    if not os.path.isdir(default_data):
        default_data = os.path.join(os.path.dirname(here), "邮满满云仓报价表")
    ap = argparse.ArgumentParser(description="邮满满云仓报价解析脚本")
    ap.add_argument("--data-dir", default=default_data, help="数据源目录（默认 ../邮满满云仓报价表）")
    ap.add_argument("--out-dir", default=os.path.join(here, "data"), help="输出目录（默认 ./data）")
    ap.add_argument("--include-zones", action="store_true", help="纳入庞大的邮编/分区对照表")
    ap.add_argument("--force", action="store_true", help="强制重写（版本号仍递增）")
    args = ap.parse_args()

    try:
        ok, info = build(args.data_dir, args.out_dir, include_zones=args.include_zones)
    except Exception as e:
        import traceback
        info = {"error": "解析脚本异常：%s" % e, "trace": traceback.format_exc()}
        ok = False

    if ok:
        print("[OK] 报价数据已生成")
        print("     版本 v%d | 更新时间 %s" % (info["version"], info["updatedAt"]))
        print("     报价表数 %d | 数据行数 %d" % (info["sheetCount"], info["totalRows"]))
        print("     数据源文件: %s" % ", ".join(info["sourceFiles"]))
        if info.get("warnings"):
            print("     [警告] %d 个工作表/文件存在解析问题：" % len(info["warnings"]))
            for w in info["warnings"][:10]:
                print("       - %s" % w)
    else:
        print("[失败] 解析未成功，已回退至上一版本。原因：%s" % info.get("error"))
        write_failure(args.out_dir, info)
        sys.exit(1)


if __name__ == "__main__":
    main()
