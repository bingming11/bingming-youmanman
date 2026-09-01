@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "PY="
where py >nul 2>nul && set "PY=py"
if not defined PY (where python >nul 2>nul && set "PY=python")
if not defined PY (where python3 >nul 2>nul && set "PY=python3")
if not defined PY (
  echo [错误] 未找到 Python。请先安装 Python 3.8+。
  pause & exit /b 1
)

if exist ".venv\Scripts\activate.bat" call .venv\Scripts\activate.bat

echo 正在重新解析报价数据 ...
python parse_prices.py
if errorlevel 1 (
  echo.
  echo [!] 解析失败：请查看上方错误信息，修复数据源文件后重试。上一版本数据已保留。
  pause & exit /b 1
)
echo.
echo [完成] 报价数据已刷新。请在浏览器中按 Ctrl+F5（或 Ctrl+R）强制刷新页面查看最新内容。
pause
