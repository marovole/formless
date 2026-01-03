# 无相 Formless · 迭代计划（MVP→上线）

> 决策前提（已确认）
> 1) 聊天必须登录  
> 2) 删除对话不联动删除记忆（放到 P1）

本计划按 **先可构建可运行 → 再闭环体验 → 再差异化/运营能力** 的顺序推进。每个迭代包含目标、主要任务、验收标准。

---

## Iteration 0（P0）：构建阻塞清零 + i18n 路由统一

**目标**
- `npm run dev` / `npm run build` 通过
- 用户端跳转不丢 `locale`（`localePrefix: 'always'`）

**主要任务**
- 路由/跳转统一（避免无 locale 的 `/chat` 直链）
  - `app/[locale]/page.tsx`：用 `@/i18n/routing` 的 `Link` 替代 `next/link`
  - `app/[locale]/auth/page.tsx`：登录成功跳转用 next-intl 导航能力（自动带 locale）
  - `app/[locale]/history/page.tsx`：Continue、Start New Conversation 等跳转统一为带 locale
  - `app/[locale]/settings/page.tsx`：语言切换用 next-intl 导航能力（不要手写 replace pathname）
- Supabase server client 导出/引用统一（修掉 import 失败）
  - `app/api/guanzhao/*`：不要引用不存在的 `createClient`；统一改为 `lib/supabase/server.ts` 提供的 server client（并确保 `cookies()` 用法一致）
- Chat UI 语言参数不要硬编码
  - `app/[locale]/chat/page.tsx`：请求 `/api/chat` 的 `language` 改用当前 `locale`（`useLocale()`）

**验收**
- `npm run build`
- 手动访问：`/zh` → 登录页 → 聊天/历史/设置不 404，URL 始终带 `/zh` 或 `/en`

---

## Iteration 1（P0）：强制登录访问聊天 + 用户侧 API 权限边界（RLS）

**目标**
- 未登录无法进入聊天/历史/设置
- 用户侧 API 不依赖可伪造的 `userId` 参数
- 用户侧数据不使用 service-role 读写（依赖 RLS + cookie session）

**主要任务**
- 页面访问控制（前端）
  - `app/[locale]/chat/page.tsx`、`app/[locale]/history/page.tsx`、`app/[locale]/settings/page.tsx`：未登录 → `/${locale}/auth?next=...`
- API 访问控制（后端）
  - `app/api/chat/route.ts`：必须从 Supabase session 获取当前 user；无 user 返回 401
  - `app/api/conversations/route.ts`、`app/api/conversations/[id]/route.ts`：移除 `userId` query；只按 `auth.uid()` 查/删
  - `app/api/memory/route.ts`：移除 `userId` query；只允许当前 user 读自己的 quotes/profile
- 数据模型对齐（避免运行时错误）
  - `app/api/chat/route.ts`：新建 `conversations` 必须写入 `user_id`
  - `lib/api-keys/manager.ts` 与调用方对齐：返回字段是 `api_key`（避免 `.key` 误用）
  - `lib/prompts/manager.ts` 与调用方对齐：明确返回 `content`（string）或返回对象（二选一统一）
  - `app/api/chat/route.ts`：写 `api_usage` 时满足必填字段（至少 `provider/tokens_used/success/...`），不写不存在字段（如 `request_type`）
- `public.users` 与 Supabase Auth 用户一致性（选一个方案落地）
  - A：Supabase trigger：`auth.users` 创建时自动插入/同步到 `public.users`（推荐）
  - B：注册成功后应用侧 upsert `public.users`（MVP 可用但要补偿机制）

**验收**
- 未登录访问 `/zh/chat` 自动跳 `/zh/auth`
- 登录后发消息成功：`conversations.user_id = 当前用户`，messages 正常写入
- 伪造 `userId` 不再能读取/删除别人的对话或记忆

---

## Iteration 2（P0）：对话主链路稳定（新对话/续聊/错误恢复）

**目标**
- 对话可持续追加（同一 `conversationId`）
- 刷新/继续对话可用
- SSE 中断/失败不把 UI 卡死

**主要任务**
- 续聊能力
  - `app/[locale]/chat/page.tsx`：支持从 URL 读取 `conversationId`
  - `app/[locale]/history/page.tsx`：Continue 跳转与 chat 读取对齐
- `/api/chat` 稳定性
  - 读取历史消息时校验对话归属（conversationId 必须属于当前 user）
  - 流式结束时 assistant message 落库失败要有兜底（不影响客户端拿到回复）
  - token 统计先做可用近似或读取 provider 返回值（不要 `chunk++` 伪计数）
- e2e 测试与“必须登录”对齐
  - `e2e/pages/chat.spec.ts`、`e2e/flows/complete-chat-flow.spec.ts`：增加登录步骤或使用 `storageState`（测试用户）

**验收**
- 同一 `conversationId` 连续发 3 轮消息，服务端能按时间返回完整 history
- Playwright 的 chat 相关用例可在已登录状态下跑通

---

## Iteration 3（P0）：记忆 V1（提取 + 召回注入）

**目标**
- 对话能“记住用户”：提取入库 + 下一次对话注入上下文

**主要任务**
- 修复提取与表结构一致
  - `app/api/memory/extract/route.ts`：写入 `key_quotes.quote/context/emotion/topic/user_id`（不要用不存在字段）
  - 提取 prompt 从 `prompts` 表读取 `memory_extractor`（中/英），不在 route 里硬编码
- 召回注入
  - `app/api/chat/route.ts`：在 system prompt 后插入“记忆摘要”（最近 N 条 quotes + profile 摘要）
- 触发时机（MVP 先简单）
  - 先做“手动触发提取”或“每次对话结束触发一次”（二选一）；异步化/队列化后置

**验收**
- 提取后 `key_quotes` 有记录、`users.profile` 有更新
- 下一次对话能确认记忆被注入（日志或输出验证即可）

---

## Iteration 4（P0）：后台可运营（Key/Prompt/Usage 真正影响线上）

**目标**
- 后台配置能实时影响对话
- 用量可追踪
- Key 轮询不超限且并发安全

**主要任务**
- Key 轮询与用量原子更新（并发安全）
  - `lib/api-keys/manager.ts` + admin routes：选择 key 后原子递增 `daily_used`（必要时用 RPC/事务思路）
- Prompt 管理闭环
  - `lib/prompts/manager.ts`：按 `role+language+is_active` 取最新/指定版本策略明确
  - `app/admin/prompts/page.tsx` + API：支持激活切换；确保 `/api/chat` 读到最新 prompt
- Usage 看板
  - `app/api/admin/usage/route.ts`：使用 view（`daily_api_usage`）或聚合 SQL 返回前端

**验收**
- 后台切换 prompt 后，下一次聊天 system prompt 立即变化
- usage 能按天/provider/model 出数

---

## Iteration 5（P1）：删除对话联动删除记忆（按需）

**目标**
- 删除对话时可选清理关联记忆（默认不清理）

**主要任务**
- `app/api/conversations/[id]/route.ts`：增加可选参数 `deleteMemory=true`（或后台批处理）
- 策略：profile 更新是否可逆（不可逆则先只删 quotes，不回滚 profile）

**验收**
- `deleteMemory=true` 时相关 `key_quotes` 被清理；默认不清理

