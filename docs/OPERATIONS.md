# 运维手册 · 监控与告警 (Operations Runbook)

> 目标:线上报错能被**及时发现**并**快速定位**。
> 对应上线清单 `TEST_PLAN.md` 第 24 项(P1 监控/告警确认)。

本应用部署在 **Cloudflare Pages/Workers**(Next.js via OpenNext)+ **Convex**(数据与函数)。
观测分三层:Cloudflare 日志、Convex 日志、应用层 `/api/health` 健康端点。

---

## 0. TL;DR — 出事了看哪里

| 现象 | 第一步 | 命令 / 位置 |
|------|--------|------------|
| 站点整体不可用 | 看健康端点 | `curl -i https://<域名>/api/health` |
| 聊天报错/无响应 | 看最近 LLM 失败 | 管理员调用 `monitoring.recentErrors`,或 `npm run pages:tail` |
| 怀疑 API key 耗尽 | 看健康详情 | 管理员 `GET /api/health?detail=1` → `metrics.providers[].available` |
| Convex 函数异常 | 看 Convex 日志 | Convex Dashboard → Logs |
| Workers 运行时异常 | 实时看日志 | `npm run pages:tail` |

---

## 1. 健康端点 `/api/health`

无需登录即可访问,供外部监控轮询。

```bash
curl -i https://<域名>/api/health
# {"status":"healthy","timestamp":"2026-..."}   HTTP 200
```

`status` 三态:

| status | HTTP | 含义 | 触发条件(见 `lib/monitoring/health.ts`) |
|--------|------|------|------------------------------------------|
| `healthy` | 200 | 正常 | Convex 可达、有可用 key、近 15 min LLM 错误率正常 |
| `degraded` | 200 | 降级仍可服务 | 部分 provider 无可用 key,或错误率 ≥ 20%(达到最小样本) |
| `unhealthy` | 503 | 不可服务 | Convex 不可达,或**所有** provider 无可用 key,或错误率 ≥ 50% |

### 管理员详情(定位用)

以管理员身份(`ADMIN_EMAILS` 内邮箱,已登录)访问:

```
GET /api/health?detail=1
```

额外返回 `reasons` 与 `metrics`:每个 provider 的 `total/active/available` key 数、近 15 min 的 `calls/failures`。非管理员带 `?detail=1` 只会拿到公开字段(不泄露)。

> 健康数据来源是**既有**的 `api_usage` 表(每次 LLM 调用都记 `success` / `error_message`,见 `app/api/chat/streaming.ts` 的 `onError`)与 `api_keys` 表。没有引入新的错误表。

---

## 2. 告警:把健康端点接到外部监控

`/api/health` 自身不推送,告警靠**外部 uptime 监控**轮询它来实现——零额外基础设施、不引入密钥。

推荐任选其一(免费档即可):

- **Cloudflare Health Checks**(同账号内最省事):Traffic → Health Checks → 监控 `/api/health`,期望 HTTP 200,失败邮件/通知。
- **UptimeRobot / Better Stack**:新增 HTTP(s) 监控,URL 填 `https://<域名>/api/health`,间隔 1–5 min。
  - 基础告警:**非 200 即告警**(覆盖 Convex 宕机、全部 key 耗尽、错误率飙升 → `unhealthy/503`)。
  - 进阶告警(可选):关键字监控,当响应体 `status` ≠ `healthy` 即告警,这样 `degraded` 也能提前预警。

配好后,"LLM 调用失败飙升 / API key 耗尽 / Convex 宕机"都会经 `unhealthy`(或 `degraded`)被监控捕获并推送给值班人。

---

## 3. Cloudflare Pages/Workers 日志

Workers 运行时日志默认不落盘,需主动 tail 或在 Dashboard 查看。

### 实时 tail(排障首选)

```bash
npm run pages:tail
# = npx wrangler pages deployment tail --project-name formless
```

会实时输出请求日志与 `console.log`。生产环境 `lib/logger.ts` 以**单行 JSON** 输出,便于 grep/解析:

```json
{"level":"error","message":"[health] admin health read failed; ...","timestamp":"...","error":"..."}
```

### Dashboard

Cloudflare Dashboard → Workers & Pages → `formless` → 选择部署 → **Logs**(近期请求+异常,约 30 分钟实时窗口)。

### 想要长期留存?

Free/Pro 无内建留存。需要时在 Dashboard → 该项目 → **Logpush** 配置 job,把日志推到 R2 或外部(Datadog 等),按需保留。当前未启用——单租户规模下 `pages:tail` + Dashboard 已够用。

> 已知坑(见 `AGENTS.md`):Workers 报错信息有限时,可用 `handleApiError` 把上下文带进响应,或检查 `wrangler.toml` 的 `compatibility_flags`。

---

## 4. Convex 日志与错误

- **Convex Dashboard → Logs**:每个 query/mutation/action 的执行与抛错,实时可查。
- **函数报错**:在 Dashboard 直接看堆栈;调用方(本应用)会把 LLM 失败写入 `api_usage(success=false, error_message)`。
- **定位最近 LLM 失败**:管理员调用 `monitoring.recentErrors`(默认 50 条,最多 200),返回 `provider / model_name / error_message / created_at`,无需翻日志。

---

## 5. 常见 LLM 错误模式对照

| error_message 关键字 | 含义 | 处理 |
|----------------------|------|------|
| `401` / `403` / `Unauthorized` | key 失效或无权限 | 在管理后台更换/停用该 key |
| `429` / `rate limit` | 触发上游限流 | 降速;确认多 key 轮换(`api_keys.priority`) |
| `insufficient_quota` / 额度 | key 当日额度耗尽 | 看 `?detail=1` 的 `available`;补 key 或等次日 `reset_at` |
| `timeout` / `ECONNRESET` | 上游网络抖动 | 通常自愈;持续则切 provider |
| 空响应 / `parse` | 上游返回异常体 | 看 `pages:tail` 原始日志定位 |

---

## 6. Sentry(暂缓,P2)

当前**未接入** Sentry。理由:结构化日志(`lib/logger.ts`)+ `api_usage` + `/api/health` + 外部 uptime 监控已满足"发现 + 定位 + 告警"。

何时再评估:用量上来后,需要**错误聚合/趋势/分组**或更细的前端异常追踪时,接 `@sentry/nextjs`(注意验证与 Cloudflare OpenNext 的兼容性及冷启动开销),免费档 5K events/月。

---

## 7. 部署前检查清单

```bash
npx wrangler pages secret list --project-name formless
```

健康端点正常工作所需(缺失会让 `?detail` 路径降级为 `degraded`):

- `CONVEX_ADMIN_TOKEN` — 供 `/api/health` 读取健康快照
- `NEXT_PUBLIC_CONVEX_URL` — Convex 地址
- `ADMIN_EMAILS` — 管理员邮箱(逗号分隔),用于 `?detail=1` 鉴权

上线后冒烟:

```bash
curl -i https://<域名>/api/health        # 期望 200 + status:"healthy"
```
