# 邮满满云仓报价 · 乐享知识库同步流程（GitHub Pages 自动发布）

## 一句话
乐享里丢 / 改报价表 → 跟我说「同步一下」，我拉最新 → 重建 `data.js` → `git push` → GitHub Actions 自动构建并发布 → 浏览器刷新即见。

## 数据源（两路，全部来自乐享知识库）

| 源 | 内容 | 乐享里的位置 |
| --- | --- | --- |
| **主 Excel 附件（生效表）** | `邮满满云仓+云途特惠+欧美专线0825.xls`（含「云仓报价」工作表 + 云途线路表 + 云仓售后） | 挂在「邮满满云仓报价」宿主页（`864f83b2391840709e336a57904b825a`）上，file_id `c5c4006bd78345a58d8ee62638689ea7`（当前**生效表**，见下方「生效表机制」） |
| **6 张文档页** | 耗材参考 / 日本药事法类目 / 欧洲国家对应税率表 / 申报价值注意事项 / 禁运品清单 / 英国偏远地区邮编 | 同宿主页下的 6 个乐享页面（markdown） |

- 「云仓报价」工作表 → 前端显示**「乐享·Excel」**蓝标（可编辑 Excel）。
- 6 张文档页 → 前端显示**「乐享·文档」**蓝标（可编辑页面）。

## 生效表机制（换表不用每次报 file_id）

当前**生效表**由 `sync_state.json` 集中记录（0825 已写入）：

```json
{
  "active_file_id": "c5c4006bd78345a58d8ee62638689ea7",
  "active_filename": "邮满满云仓+云途特惠+欧美专线0825.xls",
  "activated_at": "2026-09-02"
}
```

- **同步直接针对生效表**：我对你说「同步一下」时，用 MCP 工具
  `file_download_file(file_id = sync_state.json 里的 active_file_id)` 取临时下载 URL，
  再交给 `pull_active.py` 落盘到 `quotes/<active_filename>`。你无需再报 file_id。
- **换表（如再发一份 09xx 表）**：你在乐享上传新 Excel 后，告诉我表名即可；
  我查到新表的 file_id，把 `sync_state.json` 的 `active_file_id` / `active_filename`
  改成新的，后续同步自动走新表（本地 `quotes/` 若还留着旧表，删掉旧文件即可，
  同步脚本只吃 `quotes/` 下生效表同名文件）。
- 查看当前生效表：`python pull_active.py --show`。

## 怎么让「丢新表自动更新」生效

表格模板固定，新增表格走以下两种方式之一，同步脚本都能自动纳入，**无需改任何代码**：

- **方式 A（推荐，最像"丢一张表"）**：在乐享打开那份主 Excel，按固定模板**新增一个工作表**（列如 收费项目 / 计价依据 / 价格 / 备注）。
  我下次拉取时 `sync_from_lexiang.py` 会扫描其中所有工作表，新表自动上站。
- **方式 B**：在「邮满满云仓报价」文件夹里**新建一个乐享页面**，按固定模板写表格。
  我拉取时动态枚举该文件夹下所有页面（自动跳过 7 个废弃空 `smartsheet`、跳过与 Excel 重复的「云仓报价」页），新页面自动上站。

> 💡 单独上传全新 `.xls/.xlsx`：乐享 MCP 不提供"列出文件附件"接口，无法自动发现它；
> 但现在有**生效表机制**——你上传后告诉我表名，我把它的 file_id 写进 `sync_state.json` 的
> `active_file_id`，下次同步即自动走新表（见上方「生效表机制」），同样是一次性操作、之后全自动。

## 同步触发方式（已移除每小时自动化）

原先的 WorkBuddy 每小时同步自动化已删除。现在改为按需触发，更可控、不产生无谓提交：

- **你说一声**：「同步一下 / 刷新报价」→ 我执行拉取 + 合并 + 校验 + `git push`。
- **你自己 push**：若你手动改了 `quotes/` 或 `_lx_pages/` 并提交，push 即触发发布。
- **手动跑 Actions**：GitHub → Actions → 本工作流 → 「Run workflow」可立即重新构建发布（不换文件）。

> 乐享拉取依赖 AI 会话的 MCP 凭证，无法在 CI / 定时任务里跑；所以「拉取」由我执行，「构建 + 发布」由 GitHub Actions 全自动。

## 发布闭环（GitHub Pages 自动发布）

1. 乐享改动 → 我拉取 + 合并重建本地 `data/data.js`（含 `status.js`，版本号有变才 +1，上版备份 `data.prev.js`）；
2. 我把变更的源文件（`quotes/*.xls`、`_lx_pages/*.md`）与生成的 `data/data.js` 一起 `git add` → `commit` → `push`；
3. **GitHub Actions 自动跑 `sync_from_lexiang.py` 重新生成 `data.js` 并部署到 GitHub Pages**；
4. 用户在网址点「刷新数据」按钮（重载页面、破除缓存）即见最新。

> 一句话用法：你丢完新表到乐享，跟我说「同步一下」——我拉取 + 重建 + push，GitHub 自动发布，你刷新网址就看到最新。

## 本地校验 / 调试

```bash
python sync_from_lexiang.py            # 无变化输出 [无变化]；有变化输出 版本/表数/行数
python sync_from_lexiang.py --force    # 强制重写（版本号仍递增）
```

## 乐享页面 entry_id（参考，拉取已改为动态枚举，无需维护）

- 耗材参考 `d3dc1850a18e4d0ab3bb525b29d2a5db`
- 日本药事法涉及类目 `cae725da15f542f98c40a0dd6e03ae83`
- 欧洲国家对应税率表 `7c0bdfdd6a2d478cb5e37ef4cffb2685`
- 申报价值注意事项 `3bf20703b004456f8c9e2765d5df2f10`
- 禁运品清单 `8019996489194c9e84dc21dcd4942aa4`
- 英国偏远地区邮编 `357396625a034e19b8516b33376e5eb2`
