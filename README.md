# 股票精灵 · STOCK WIZARD

把股票当成神奇宝贝来捕捉、观察、分析的红白机风格图鉴。

需求文档见 [`docs/需求文档.md`](docs/需求文档.md)。

```bash
npm install
npm run dev
```

打开终端提示的本地地址即可游玩。数据为内置演示行情，不构成投资建议。

## 生产部署（子路径 /StockWizard）

生产由 `server/index.mjs`（Express）托管 `dist`，并复用与开发环境同一套接口：东财行情代理 `/radar/*` 与报告存储 `/api/reports`（数据落在 `data/reports`）。

环境变量（见 `.env.example`）：`PORT`、`HOST`、`BASE_PATH`、`DATA_DIR`，构建时通过 `VITE_BASE` 指定子路径，二者需保持一致。

```bash
VITE_BASE=/StockWizard/ npm run build
BASE_PATH=/StockWizard PORT=3280 npm start
# 或 pm2 start ecosystem.config.js
```

nginx 反代（**保留前缀**，不要加尾斜杠）：

```nginx
location = /StockWizard { return 301 /StockWizard/; }
location /StockWizard/ {
  proxy_pass http://127.0.0.1:3280;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```
