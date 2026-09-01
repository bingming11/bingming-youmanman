#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
本地静态服务器 + 一键刷新接口
================================
- 提供 quote-site 目录的静态文件访问（http://localhost:8765）
- POST /refresh  -> 重新扫描数据源目录并生成 data.js / status.js，返回 JSON 结果
- 网页右上角“刷新数据”按钮即调用此接口，成功后自动重载页面

仅依赖 Python 标准库，无需额外安装。
"""

import os
import sys
import json
import urllib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("QUOTE_PORT", "8765"))

# 允许跨目录读取数据源（quotes/ + _lx_pages/）的解析脚本
sys.path.insert(0, HERE)
import parse_prices as pp
import sync_from_lexiang as sl


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=HERE, **kwargs)

    def do_POST(self):
        if self.path.rstrip("/") == "/refresh":
            try:
                # 用「乐享双源」合并脚本重建 data.js（依赖本地 quotes/ 与 _lx_pages/ 已是最新）
                ok, info = sl.build(
                    os.path.join(HERE, "quotes"),
                    os.path.join(HERE, "_lx_pages"),
                    os.path.join(HERE, "data"),
                )
                body = json.dumps({
                    "ok": ok,
                    "version": info.get("version"),
                    "updatedAt": info.get("updatedAt"),
                    "sheetCount": info.get("sheetCount"),
                    "totalRows": info.get("totalRows"),
                    "error": info.get("error"),
                }, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except Exception as e:
                import traceback
                body = json.dumps({"ok": False, "error": "刷新异常：%s" % e,
                                   "trace": traceback.format_exc()}, ensure_ascii=False).encode("utf-8")
                self.send_response(500)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            return
        self.send_error(404)

    def log_message(self, fmt, *args):
        sys.stderr.write("[" + self.address_string() + "] " + (fmt % args) + "\n")


def pp_default_data_dir():
    # 容器/云端部署时可用环境变量指定报价表目录（本地默认取上级目录的「邮满满云仓报价表」）
    env = os.environ.get("QUOTE_DATA_DIR")
    if env:
        return env
    return os.path.join(os.path.dirname(HERE), "邮满满云仓报价表")


def main():
    os.chdir(HERE)
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("邮满满报价网站已启动： http://localhost:%d" % PORT)
    print("按 Ctrl+C 停止服务。")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已停止。")
        httpd.shutdown()


if __name__ == "__main__":
    main()
