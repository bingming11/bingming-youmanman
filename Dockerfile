# 邮满满云仓报价网站 · 容器镜像
# 使用方式见 DEPLOY.md（方式二）
FROM python:3.11-slim

WORKDIR /app

# 依赖（xlrd 1.2.0 支持真正的 .xls；openpyxl 支持 .xlsx）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 站点与解析脚本
COPY . .

# 容器外通过环境变量指定报价表目录，并挂载进 /data/quotes
# 例如：-e QUOTE_DATA_DIR=/data/quotes -v /本地报价表:/data/quotes
ENV QUOTE_DATA_DIR=/data/quotes
ENV QUOTE_PORT=8765

EXPOSE 8765

# server.py 已绑定 0.0.0.0，容器外可直接访问
CMD ["python", "server.py"]
