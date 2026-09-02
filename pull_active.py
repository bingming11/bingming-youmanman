#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
生效表拉取助手（配合 sync_state.json）
======================================
正常同步流程需要乐享 MCP 凭证取临时下载地址，本脚本无法独立调乐享接口，
因此承担「拿到临时 URL 后落盘」这一步：

  1) 我对你说「同步一下」时，会用 MCP 工具
     file_download_file(file_id = sync_state.json 里的 active_file_id)
     取得一个 10 分钟有效的临时下载 URL；
  2) 然后运行本脚本把该 URL 落盘到 quotes/ 生效表同名文件：

     python pull_active.py "<临时下载URL>"

  脚本会读取 sync_state.json 的 active_filename 作为落盘文件名，
  下载完成后提示你（或我）再跑 sync_from_lexiang.py 重建 data.js。

用法：
  python pull_active.py "<temp_url>"          # 下载生效表到 quotes/
  python pull_active.py --show                # 仅打印当前生效表信息（file_id / 文件名）
"""
import os
import sys
import json
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))


def load_state():
    p = os.path.join(HERE, "sync_state.json")
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def main():
    args = sys.argv[1:]
    if args and args[0] == "--show":
        st = load_state()
        print("生效表：")
        print("  file_id :", st.get("active_file_id"))
        print("  文件名   :", st.get("active_filename"))
        print("  激活于   :", st.get("activated_at"))
        print("  说明     :", st.get("note", ""))
        return

    if not args:
        print("用法：python pull_active.py \"<临时下载URL>\"   （或 --show 查看生效表信息）")
        sys.exit(1)

    url = args[0]
    st = load_state()
    fname = st.get("active_filename") or "active.xls"
    out = os.path.join(HERE, "quotes", fname)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    print("下载生效表 ->", out)
    urllib.request.urlretrieve(url, out)
    print("完成，大小 %d 字节。下一步：运行 sync_from_lexiang.py 重建 data.js。" % os.path.getsize(out))


if __name__ == "__main__":
    main()
