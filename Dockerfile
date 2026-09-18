# 作者：肖沐樑　QQ：3387432690
# 完成时间：2026，09，18
FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
COPY . .
EXPOSE 8765
CMD ["python", "server.py"]
