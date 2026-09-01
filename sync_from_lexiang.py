#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
邮满满云仓报价展示网站 —— 乐享知识库同步脚本
================================================

数据来源（双源合并）：
  源1（Excel，即乐享「邮满满云仓报价」文件夹里的附件）:
      quotes/ 下的「邮满满云仓+云途特惠+欧美专线0810(3).xls」
      （约 8.5MB / 21 个工作表，含「云仓报价」「云仓售后」+ 18 张线路/分区表）。
      该文件就是乐享知识库「邮满满云仓报价」页面的附件；同步前由对话中的
      MCP 工具 file_download_file 取临时下载 URL -> curl 落盘覆盖 quotes/ 同名文件，
      再走 Excel 解析链路。「云仓报价」工作表标记为 source=lexiang /
      sourceKind=excel，前端显示「乐享·Excel」蓝色可编辑标签。
  源2（乐享知识库 markdown 页面镜像，6 张参考小表）:
      _lx_pages/*.md —— 由 entry_describe_ai_parse_content 拉取回写：
      耗材参考 / 日本药事法涉及类目 / 欧洲国家对应税率表 /
      申报价值注意事项 / 禁运品清单 / 英国偏远地区邮编。
      （大 Excel 内若含同名表一律跳过，以这 6 张 markdown 为准。）

编辑闭环：
  同事在乐享改「邮满满云仓+云途特惠+欧美专线0810(3).xls」这个附件
  -> 拉取（file_download_file -> quotes/同名.xls）-> 本脚本解析（含「云仓报价」sheet）
  + 改其余 6 张表 -> 拉取（entry_describe_ai_parse_content -> _lx_pages/*.md）
  -> 本脚本合并两源重建 data/data.js（含版本号递增、上一版备份 data.prev.js）。

说明：
  乐享连接器为平台托管（无本地 API token），本脚本不直接调乐享接口，
  “拉取”动作由对话中的 MCP 工具完成（见 SYNC.md）。本脚本只负责
  “合并两源 + 写前端数据文件”。

用法：
  python sync_from_lexiang.py                 # 默认：quotes/ + _lx_pages/ -> data/
  python sync_from_lexiang.py --excel-dir DIR --md-dir DIR --out-dir DIR
  python sync_from_lexiang.py --include-zones # 连庞大的邮编/分区对照表也一并纳入
  python sync_from_lexiang.py --force         # 即使无变化也重写（版本号仍递增）
"""

import os
import re
import sys
import json
import shutil
import datetime
import argparse

# 复用既有 Excel 解析逻辑（分类 / 表头检测 / 工作表->记录 等）
import parse_prices as pp

DATA_VAR = "window.YUNMANMAN_DATA"
STATUS_VAR = "window.YUNMANMAN_STATUS"


# ---------------------------------------------------------------------------
# 源2：乐享 markdown 表 -> 记录
# ---------------------------------------------------------------------------

def _split_md_row(line):
    r"""按 `|` 切分 markdown 表格行；保留转义 `\|`（不切）。"""
    s = line.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|"):
        s = s[:-1]
    parts = re.split(r"(?<!\\)\|", s)
    return [p.replace("\\|", "|").strip() for p in parts]


def _is_separator(cells):
    """判断是否为 markdown 分隔行（|---|---|）。"""
    if not cells:
        return False
    for c in cells:
        if set(c) - set("-: "):
            return False
    return True


def md_sheet_to_record(md_path):
    """把一个 markdown 文件（含一张表格）解析为与 parse_prices 同构的记录。"""
    name = os.path.splitext(os.path.basename(md_path))[0]
    with open(md_path, "r", encoding="utf-8") as f:
        lines = [ln.rstrip("\n") for ln in f]

    # 仅取以 | 开头的表格行
    table_lines = [ln for ln in lines if ln.strip().startswith("|")]
    if len(table_lines) < 2:
        return None

    header = _split_md_row(table_lines[0])
    rows = []
    for ln in table_lines[1:]:
        cells = _split_md_row(ln)
        if _is_separator(cells):
            continue
        rows.append(cells)

    if not rows:
        return None

    # 列对齐
    ncol = max(len(header), *(len(r) for r in rows))
    header = header + [""] * (ncol - len(header))
    aligned = []
    for r in rows:
        r = (r + [""] * (ncol - len(r)))[:ncol]
        aligned.append(r)

    return {
        "type": "table",
        "name": name,
        "category": pp.classify_category(name),
        "meta": {"source": "lexiang"},
        "headers": header,
        "rows": aligned,
        "rowCount": len(aligned),
        "source": "lexiang",
    }


def collect_md(md_dir):
    out = []
    if not os.path.isdir(md_dir):
        return out
    for fn in sorted(os.listdir(md_dir)):
        if fn.lower().endswith(".md") and not fn.startswith("."):
            rec = md_sheet_to_record(os.path.join(md_dir, fn))
            if rec:
                out.append(rec)
    return out


# ---------------------------------------------------------------------------
# 源1：Excel 线路表（复用 parse_prices）
# ---------------------------------------------------------------------------

def collect_excel(excel_dir, include_zones=False):
    out = []
    if not os.path.isdir(excel_dir):
        return out, []
    supported = (".xls", ".xlsx", ".xlsm")
    source_files = []
    errors = []
    # 以下 6 张参考表由乐享 markdown 页面（_lx_pages/*.md）单独管理；
    # 大线路表 .xls 内若含同名表一律跳过，避免重复（以 markdown 为准）。
    # 注意：「云仓报价」sheet 不再排除——它正是用户要在乐享 Excel 里改的那张，
    # 现在直接来自这份大 Excel（乐享附件）。
    lexiang_managed_sheets = {
        "耗材参考", "日本药事法涉及类目", "欧洲国家对应税率表",
        "申报价值注意事项", "禁运品清单", "英国偏远地区邮编",
    }
    for fn in sorted(os.listdir(excel_dir)):
        if fn.startswith("~$") or fn.startswith("."):
            continue
        if not fn.lower().endswith(supported):
            continue
        fp = os.path.join(excel_dir, fn)
        try:
            wb = pp.read_workbook(fp)
            if wb is None:
                errors.append({"file": fn, "error": "不支持的格式，已跳过"})
                continue
            for sname, srows in wb:
                if (not include_zones) and pp.DEFAULT_EXCLUDE_RE.search(sname):
                    continue
                # 6 张参考表以乐享 markdown 为准，大 Excel 内同名表跳过（避免重复）
                if sname in lexiang_managed_sheets:
                    continue
                try:
                    rec = pp.sheet_to_record(sname, srows, include_zones)
                    if rec:
                        rec["sourceFile"] = fn
                        out.append(rec)
                except Exception as e:
                    errors.append({"file": fn, "sheet": sname, "error": str(e)})
            source_files.append({"name": fn,
                                  "sizeKB": round(os.path.getsize(fp) / 1024, 1),
                                  "sheets": len(wb)})
        except Exception as e:
            errors.append({"file": fn, "error": "文件读取失败：%s" % e})
    return out, source_files, errors


# ---------------------------------------------------------------------------
# 合并 + 写出
# ---------------------------------------------------------------------------

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


def _normalize_for_compare(payload):
    """去掉随时间变化的字段，仅比较「数据内容」本身是否变化。"""
    p = {k: v for k, v in payload.items()
         if k not in ("version", "updatedAt", "generatedAtISO")}
    return json.dumps(p, ensure_ascii=False, sort_keys=True)


def _load_existing_payload(data_js_path):
    try:
        with open(data_js_path, "r", encoding="utf-8") as f:
            txt = f.read()
        m = re.search(re.escape(DATA_VAR) + r"\s*=\s*", txt)
        if m:
            return json.loads(txt[m.end():].rstrip().rstrip(";"))
    except Exception:
        pass
    return None


def build(excel_dir, md_dir, out_dir, include_zones=False, force=False):
    os.makedirs(out_dir, exist_ok=True)
    data_js = os.path.join(out_dir, "data.js")
    status_js = os.path.join(out_dir, "status.js")
    prev_js = os.path.join(out_dir, "data.prev.js")

    excel_sheets, source_files, excel_errors = collect_excel(excel_dir, include_zones)
    md_sheets = collect_md(md_dir)

    # 「云仓报价」工作表来自乐享 Excel 附件，标记为可编辑来源（前端显示「乐享·Excel」标签）
    for s in excel_sheets:
        if s.get("name") == "云仓报价":
            s["source"] = "lexiang"
            s["sourceKind"] = "excel"
            s["lexiangEditable"] = True

    sheets = excel_sheets + md_sheets
    if not sheets:
        return False, {"error": "Excel 与 乐享 markdown 两源均无有效数据，未生成。",
                       "excelErrors": excel_errors}

    cat_order = {"线路报价": 0, "云仓服务": 1, "参考规则": 2}
    sheets.sort(key=lambda s: (cat_order.get(s.get("category"), 9), s["name"]))

    total_rows = sum(s.get("rowCount", len(s.get("blocks", []))) for s in sheets)

    # 先构造 payload（版本号占位，检测通过后再填真实版本）
    payload = {
        "version": 0,
        "updatedAt": "",
        "generatedAtISO": "",
        "syncMode": "excel+lexiang",
        "excelDir": os.path.abspath(excel_dir),
        "mdDir": os.path.abspath(md_dir),
        "sourceFiles": source_files,
        "mdSheetCount": len(md_sheets),
        "sheetCount": len(sheets),
        "totalRows": total_rows,
        "includeZones": include_zones,
        "sheets": sheets,
    }

    # ---- 变更检测：内容没变就跳过，避免无谓涨版本号 ----
    if not force and os.path.exists(data_js):
        old_payload = _load_existing_payload(data_js)
        if old_payload is not None and _normalize_for_compare(old_payload) == _normalize_for_compare(payload):
            return True, {
                "noChange": True,
                "version": old_payload.get("version", 0),
                "sheetCount": len(sheets),
                "mdSheetCount": len(md_sheets),
                "excelSheetCount": len(excel_sheets),
                "totalRows": total_rows,
                "sourceFiles": [f["name"] for f in source_files],
                "warnings": excel_errors,
            }

    old_version = _read_old_version(data_js)
    new_version = old_version + 1
    now = datetime.datetime.now()
    updated_at = now.strftime("%Y-%m-%d %H:%M:%S")
    payload["version"] = new_version
    payload["updatedAt"] = updated_at
    payload["generatedAtISO"] = now.isoformat(timespec="seconds")

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
        "mdSheetCount": len(md_sheets),
        "errors": excel_errors,
    }, ensure_ascii=False))
    with open(status_js, "w", encoding="utf-8") as f:
        f.write(status_txt)

    return True, {
        "version": new_version,
        "updatedAt": updated_at,
        "sheetCount": len(sheets),
        "mdSheetCount": len(md_sheets),
        "excelSheetCount": len(excel_sheets),
        "totalRows": total_rows,
        "sourceFiles": [f["name"] for f in source_files],
        "warnings": excel_errors,
    }


def write_failure(out_dir, error_info):
    os.makedirs(out_dir, exist_ok=True)
    status_js = os.path.join(out_dir, "status.js")
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    prev_version = _read_old_version(os.path.join(out_dir, "data.js"))
    status_txt = '%s = %s;\n' % (STATUS_VAR, json.dumps({
        "ok": False,
        "error": error_info.get("error", "未知同步错误"),
        "detail": error_info,
        "fallbackVersion": prev_version,
        "updatedAt": now,
    }, ensure_ascii=False))
    with open(status_js, "w", encoding="utf-8") as f:
        f.write(status_txt)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description="邮满满云仓报价 —— 乐享知识库同步脚本")
    ap.add_argument("--excel-dir", default=os.path.join(here, "quotes"),
                    help="Excel 线路报价目录（默认 ./quotes）")
    ap.add_argument("--md-dir", default=os.path.join(here, "_lx_pages"),
                    help="乐享 markdown 镜像目录（默认 ./_lx_pages）")
    ap.add_argument("--out-dir", default=os.path.join(here, "data"),
                    help="输出目录（默认 ./data）")
    ap.add_argument("--include-zones", action="store_true",
                    help="纳入庞大的邮编/分区对照表")
    ap.add_argument("--force", action="store_true", help="强制重写（版本号仍递增）")
    args = ap.parse_args()

    try:
        ok, info = build(args.excel_dir, args.md_dir, args.out_dir,
                         include_zones=args.include_zones, force=args.force)
    except Exception as e:
        import traceback
        info = {"error": "同步脚本异常：%s" % e, "trace": traceback.format_exc()}
        ok = False

    if ok:
        if info.get("noChange"):
            print("[无变化] 乐享内容与本地一致，未重写 data.js（版本保持 v%d）" % info["version"])
            print("     报价表数 %d（Excel %d + 乐享 %d）| 数据行数 %d"
                  % (info["sheetCount"], info["excelSheetCount"],
                     info["mdSheetCount"], info["totalRows"]))
            return
        print("[OK] 报价数据已合并生成（Excel + 乐享）")
        print("     版本 v%d | 更新时间 %s" % (info["version"], info["updatedAt"]))
        print("     报价表数 %d（Excel %d + 乐享 %d）| 数据行数 %d"
              % (info["sheetCount"], info["excelSheetCount"],
                 info["mdSheetCount"], info["totalRows"]))
        print("     数据源文件: %s" % ", ".join(info["sourceFiles"]))
        if info.get("warnings"):
            print("     [警告] %d 个 Excel 工作表存在解析问题：" % len(info["warnings"]))
            for w in info["warnings"][:10]:
                print("       - %s" % w)
    else:
        print("[失败] 同步未成功，已回退至上一版本。原因：%s" % info.get("error"))
        write_failure(args.out_dir, info)
        sys.exit(1)


if __name__ == "__main__":
    main()
