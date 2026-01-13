# Scripts

本目录提供一些部署/自检脚本，面向当前架构：

- Auth: Clerk
- Backend/DB: Convex
- Frontend: Next.js → Cloudflare Pages (OpenNext)

## 列表

### 1) `scripts/check-env.sh`

用途：检查本地工具链、关键文件、`.env.local` 以及（尽力）检查 Convex 部署环境变量。

```bash
./scripts/check-env.sh
```

### 2) `scripts/deploy-db.sh`

用途：部署 Convex 后端（prod）。

```bash
./scripts/deploy-db.sh
```

### 3) `scripts/deploy-functions.sh`

用途：部署 Cloudflare Pages 前端（调用 `npm run deploy`）。

```bash
./scripts/deploy-functions.sh
```

### 4) `scripts/deploy-all.sh`

用途：一键部署 Convex + Cloudflare Pages。

```bash
./scripts/deploy-all.sh
```

可选：

```bash
./scripts/deploy-all.sh --skip-backend
./scripts/deploy-all.sh --skip-frontend
```

### 5) `scripts/deploy-pages.sh`

用途：仅部署 Cloudflare Pages，并输出需要配置的环境变量清单。

```bash
./scripts/deploy-pages.sh
```

### 6) `scripts/test-guanzhao.sh`

用途：运行一组与 Guanzhao/Convex 相关的基础校验（type-check + unit tests）。

```bash
./scripts/test-guanzhao.sh
```

