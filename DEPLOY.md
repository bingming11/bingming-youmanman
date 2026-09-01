# 邮满满云仓报价网站 · 云端部署指南

本目录是一个**纯静态网站**：页面数据通过 `<script>` 标签加载 `data/data.js`，
不依赖后端接口（`/refresh` 除外）。因此部署到云端非常简单——把整个 `quote-site`
目录托管出去，其他人用浏览器打开网址即可使用，无需安装任何环境。

## 部署前必做（一步）

先把最新报价解析进 `data.js`（确保线上数据和本地报价表一致）：

```bash
# 推荐：双源合并（Excel 线路表 + 乐享知识库：云仓报价工作表 + 6 张文档页）
python sync_from_lexiang.py
# 或仅重新解析 Excel 线路表（不含乐享表）：
python parse_prices.py
```

> 只要 `data.js` 是最新的，下面的托管方式都不需要 Python 环境。

### 数据来源与编辑分工（重要）

本网站的数据来自**两个源**，请按下面的分工维护：

| 源 | 内容 | 谁改 | 怎么生效 |
| --- | --- | --- | --- |
| **云途线路报价表**（Excel，巨大） | 18 张专线/线路报价表（约 2100 行） | 财务/报价负责人更新 `.xls` | 放进 `quotes/` → 跑脚本 |
| **乐享知识库 · 云仓报价（Excel）** | 云仓报价（一件代发各项操作费 + 仓租） | **运营同事改乐享 Excel 附件里的「云仓报价」工作表** | 拉取回 `quotes/邮满满云仓+云途特惠+欧美专线0810(3).xls` → 跑脚本 |
| **乐享知识库 · 6 张文档页** | 耗材参考 / 日本药事法类目 / 欧洲税率表 / 申报价值注意事项 / 禁运品清单 / 英国偏远邮编 | **运营同事直接在乐享页面改** | 拉取回 `_lx_pages/` → 跑脚本 |

- 运营同事**只需要在乐享知识库改**：云仓报价改乐享 Excel 附件 `邮满满云仓+云途特惠+欧美专线0810(3).xls` 里的「云仓报价」工作表（Excel，最好改），其余 6 张改文档页，无需碰本地 Excel、无需碰代码。
- 拉取动作由对话中的 MCP 工具完成：云仓报价所在的 Excel 附件用 `file_download_file` 取临时下载 URL 落盘覆盖 `quotes/邮满满云仓+云途特惠+欧美专线0810(3).xls`；6 张文档页用 `entry_describe_ai_parse_content` 写回 `quote-site/_lx_pages/*.md`；
  然后 `python sync_from_lexiang.py` 合并两源、重建 `data/data.js`。
- 详细同步流程见 **`SYNC.md`**。

---

## 方式一：静态托管（推荐 · 最简单 · 零运维）

适合「让别人查看报价」的场景。任选一个平台，**把 `quote-site` 整个文件夹作为站点根目录发布**即可。

### A. 腾讯云 CloudBase 静态网站托管（推荐，同生态）
```bash
npm i -g @cloudbase/cli
tcb login
# 把整个 quote-site 目录发布到你的云开发环境（envId 在云控制台获取）
tcb hosting deploy quote-site -e 你的EnvId
```
- 发布后控制台「静态网站托管」会给出默认域名 `https://你的EnvId.tcloudbaseapp.com`。
- 可绑定自定义域名 + 一键 HTTPS。
- 已附 `cloudbase.json`（填入 envId 即可）。

### B. 腾讯云 EdgeOne Pages（边缘加速，访问更快）
1. 在 EdgeOne Pages 控制台「新建项目」→ 连接 Git 仓库（或直接上传文件夹）。
2. 构建配置：**根目录 = `quote-site`**，**构建命令留空**（数据已预生成），**输出目录 = `.`**。
3. 部署完成后获得 `*.pages.dev` 域名，可绑定自定义域名。

### C. GitHub Pages / Netlify / Vercel（通用）
- **GitHub Pages**：新建仓库，把 `quote-site` 内容放到仓库根目录，Settings → Pages → 选 `main` 分支根目录。
- **Netlify**：拖拽 `quote-site` 文件夹到 app.netlify.com/drop，或连 Git（已附 `netlify.toml`）。
- **Vercel**：导入仓库，Framework 选 `Other`，Output Directory 填 `.`（已附 `vercel.json`）。

### 静态托管的更新流程
报价表有变动时：
1. **线路报价变**：本地把新 `.xls/.xlsx/.csv` 放进 `quotes/`；
2. **云仓报价变**：同事在乐享 Excel 附件改「云仓报价」工作表 → 拉取回 `quotes/邮满满云仓+云途特惠+欧美专线0810(3).xls`；
3. **其余 6 张文档页变**：同事在乐享知识库改完 → 拉取回 `quote-site/_lx_pages/*.md`；
3. 运行 `python sync_from_lexiang.py`（合并两源，生成新的 `data.js`）；
4. 重新发布（重跑上述部署命令 / 重新拖拽 / 重新 push）。

> 静态托管下页面右上角「刷新数据」按钮：已修复为「点击重新加载线上最新 data.js」（带缓存破除），不再报错、不再弹失败。
> 它不会直接调后端（静态托管无 `/refresh` 进程），仅重载页面以拉取**已发布**的最新数据；
> 乐享里的改动经自动化拉取+重建本地 `data.js` 后，**需由维护者重新发布 CloudStudio** 方能在线生效（详见下方「与 CloudStudio 的关系」）。

---

## 方式二：容器 / 服务器部署（保留云端实时刷新）

适合「希望运营同事在后台放新报价表后，网站自己更新」的场景。
`server.py` 已绑定 `0.0.0.0`，并支持用 `QUOTE_DATA_DIR` 指定报价表目录。

### Docker（任意云服务器 / 腾讯云 CloudBase CloudRun / 阿里云）
```bash
# 构建
docker build -t yumanman-quote .
# 运行（把报价表目录挂进容器，端口 8765）
docker run -d --name yumanman-quote \
  -p 8080:8765 \
  -v /path/to/邮满满云仓报价表:/data/quotes \
  -e QUOTE_DATA_DIR=/data/quotes \
  yumanman-quote
```
- 访问 `http://服务器IP:8080`，页面「刷新数据」按钮会调用容器内 `/refresh` 重新解析。
- 已附 `Dockerfile` 与 `docker-compose.yml`（含报价表挂载卷）。

### 用 docker-compose 一步起
```bash
# 先把报价表放到 ./quotes 目录，再：
docker compose up -d
```

### 反向代理 + HTTPS（生产建议）
用 Nginx / Caddy 把 8080 反代到域名并配证书；CloudBase CloudRun / 各大云厂商
「Web 服务」控制台通常自带域名与 HTTPS，按界面填镜像即可。

---

## 访问与权限建议

- **公开 vs 内网**：报价含商业信息，若仅内部/客户使用，建议放在
  内网、或用平台自带「访问密码 / IP 白名单 / 私有访问」能力。
- **自定义域名 + HTTPS**：CloudBase / EdgeOne / Vercel / Netlify 均支持一键绑定。
- **/refresh 安全**：方式二中该接口对公网开放，任何人可触发重解析（仅重读文件、
  风险低）。若担心被滥用，可在反代层加 Basic Auth 或仅允许内网访问。

## 方式三：GitHub Pages + GitHub Actions 自动发布（免费 · 推荐）

> 不想花服务器钱，又想「报价一变网站就自动更新」→ 走这条。
> 本质：把报价源表（`quotes/` 的 Excel + `_lx_pages/*.md` 的乐享表）和解析脚本一起进 Git 仓库，
> GitHub Actions 每次 push 自动重跑 `sync_from_lexiang.py` 并部署到 GitHub Pages。
> **GitHub Actions + Pages 公开仓库免费**；本仓库无需任何密钥（Pages 用内置 OIDC）。

### 已准备好的文件
- `sync_from_lexiang.py`：双源合并脚本（读 `quotes/` 的 Excel + `_lx_pages/*.md` 的乐享表），CI 用它重建 `data.js`。
- `quotes/`：已放入当前报价源表（`.xls`，含「云仓报价」工作表），随仓库一起提交，CI 才能读到。
- `_lx_pages/`：乐享知识库 6 张文档页（耗材参考等）的 markdown 镜像，随仓库一起提交，CI 才能合并。
- `.github/workflows/deploy.yml`：检出 → 装依赖 → `sync_from_lexiang.py` 生成 `data.js` → 上传产物 → 部署到 GitHub Pages。
- `.nojekyll`：关闭 Jekyll，避免下划线目录被忽略。
- 触发：① `push` 到 main/master 即自动构建并发布；② 在 Actions 页面点「Run workflow」手动立即发布。

### 你的操作（一次性）
1. **建 GitHub 仓库**：新建一个仓库（建议私有，避免报价源表外泄），把 `quote-site/` 整个目录内容推上去（含 `.github/`、`quotes/`、`_lx_pages/`、`.nojekyll`）。
2. **开 GitHub Pages**：仓库 → Settings → Pages → Build and deployment → Source 选 **「GitHub Actions」**。
3. **首次部署**：`git push` 一次（或 Actions 页点「Run workflow」），跑完即上线。
   Pages 给出 `https://<用户名>.github.io/<仓库名>/`，可绑自定义域名 + HTTPS（Settings → Pages → Custom domain）。

### 以后怎么更新报价（自动发布闭环）
- **乐享表变了**：告诉我「同步一下」，我拉取乐享最新表 → 更新 `quotes/*.xls` 与 `_lx_pages/*.md` → 跑 `sync_from_lexiang.py` 校验 → `git add` → `commit` → `push` → **GitHub Actions 自动构建并发布**，你刷新网址即见最新。
- **手动立即发布（不换文件）**：GitHub → Actions → 本工作流 → 「Run workflow」点一下即可。
- 注意：乐享拉取依赖 AI 会话的 MCP 凭证，无法在 CI 跑，所以「拉取」一步由我执行，「构建 + 发布」一步交给 GitHub Actions 全自动。

### 与 CloudStudio 的关系
旧 CloudStudio 静态链接可在「设置 - 数据管理 - 我发布的应用」下线（或保留只读均可），
改用 GitHub Pages 域名；从此「维护者 push → 自动上线」，不再需要手动重新发布。
原先的 WorkBuddy 每小时同步自动化已移除（避免重复），同步改由「你说一声 / push」触发。

## 文件清单（部署相关）
```
quote-site/
├─ index.html          站点入口（发布根）
├─ data/               预生成的 data.js / status.js（已含最新报价）
├─ assets/             style.css / app.js / calc.js
├─ parse_prices.py     线路报价解析脚本（仅 Excel，维护者本地/容器内用）
├─ sync_from_lexiang.py 双源合并脚本（Excel 线路表 + 乐享知识库：云仓报价工作表 + 6 文档页）
├─ SYNC.md             乐享知识库同步流程说明（编辑闭环）
├─ quotes/邮满满云仓+云途特惠+欧美专线0810(3).xls 乐享 Excel 附件（含「云仓报价」工作表），同步源之一，由乐享拉取
├─ _lx_pages/          乐享知识库 6 张文档页的 markdown 镜像（同步源之一）
├─ server.py           本地/容器服务器（含 /refresh）
├─ requirements.txt    xlrd==1.2.0, openpyxl
├─ cloudbase.json      CloudBase 环境配置
├─ netlify.toml        Netlify 发布配置
├─ vercel.json         Vercel 发布配置
├─ Dockerfile          容器构建
├─ docker-compose.yml  容器编排（含报价表挂载）
└─ DEPLOY.md           本文件
```
