@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM ---- 选择 Python 解释器（优先 py 启动器，其次 python / python3）----
set "PY="
where py >nul 2>nul && set "PY=py"
if not defined PY (where python >nul 2>nul && set "PY=python")
if not defined PY (where python3 >nul 2>nul && set "PY=python3")
if not defined PY (
  echo [错误] 未找到 Python。请先安装 Python 3.8+ 并勾选“Add Python to PATH”。
  pause & exit /b 1
)

REM ---- 首次运行创建虚拟环境并安装依赖 ----
if not exist ".venv" (
  echo [1/3] 创建虚拟环境 .venv ...
  "%PY%" -m venv .venv
)
call .venv\Scripts\activate.bat

echo [2/3] 安装依赖（xlrd / openpyxl）...
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt

echo [3/3] 解析报价数据 ...
python parse_prices.py

echo.
echo 正在启动本地服务 http://localhost:8765 ...
start "" http://localhost:8765
python server.py
