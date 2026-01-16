# 无相 Formless · MVP 开发计划

## 技术栈确认

| 层级 | 选型 |
|------|------|
| 框架 | Next.js 15 (App Router) |
| 部署 | Cloudflare Pages |
| 数据库/后端 | Convex |
| 认证 | Clerk |
| 国际化 | next-intl |
| 样式 | Tailwind CSS |
| 后台 UI | shadcn/ui |
| 对话模型 | DeepSeek R1 (Chutes) |
| 提取模型 | GLM-4.5-Air (OpenRouter) |

---

## 开发阶段

### Phase 1：基础搭建（1-2 天）

| 任务 | 说明 |
|------|------|
| ✅ 项目初始化 | Next.js + Cloudflare 适配 |
| ✅ Convex 配置 | 创建项目、Schema、Functions、权限控制 |
| ✅ 国际化配置 | next-intl 路由 + 基础文案 |
| ✅ shadcn/ui 安装 | 后台基础组件 |
| ✅ 环境变量配置 | 本地 + Cloudflare |

**产出**：可运行的空项目骨架

---

### Phase 2：后台核心（2-3 天）

| 任务 | 说明 |
|------|------|
| ✅ 管理员认证 | 登录、Session 管理 |
| ✅ API Key 管理 | 增删改查、轮询逻辑 |
| ✅ 用量统计 | 基础统计、图表展示 |
| ✅ Prompt 管理 | 编辑、保存、版本 |

**产出**：可管理 API Key 和 Prompt 的后台

---

### Phase 3：对话核心（3-4 天）

| 任务 | 说明 |
|------|------|
| ✅ LLM 调用封装 | Chutes + OpenRouter + Key 轮询 |
| ✅ 流式响应 | SSE 流式输出 |
| ✅ 对话 API | /api/chat 接口 |
| ✅ 对话 UI | ChatContainer、MessageBubble |
| ✅ 无相长老 Prompt | 接入 Prompt 管理 |

**产出**：可以和无相长老对话

---

### Phase 4：记忆系统（2-3 天）

| 任务 | 说明 |
|------|------|
| ✅ 记忆提取 | 对话结束后异步提取 |
| ✅ 记忆召回 | 对话开始时注入 Context |
| ✅ 用户档案 | profile JSON 管理 |
| ✅ 对话历史 | 列表、删除功能 |

**产出**：长老能记住用户

---

### Phase 5：用户系统（1-2 天）

| 任务 | 说明 |
|------|------|
| ✅ 用户注册/登录 | Clerk Auth |
| ✅ 用户设置页 | 语言、主题 |
| ✅ 后台用户管理 | 查看用户列表、详情 |

**产出**：完整的用户体系

---

### Phase 6：Landing & 上线（1-2 天）

| 任务 | 说明 |
|------|------|
| ✅ Landing Page | 首页设计实现 |
| ✅ SEO 优化 | Meta、OG Image |
| ☐ 域名配置 | Cloudflare DNS |
| ☐ 上线测试 | 全流程走通 |

**产出**：可发布的 MVP

---

## 时间估算

| 阶段 | 时间 |
|------|------|
| Phase 1 基础搭建 | 1-2 天 |
| Phase 2 后台核心 | 2-3 天 |
| Phase 3 对话核心 | 3-4 天 |
| Phase 4 记忆系统 | 2-3 天 |
| Phase 5 用户系统 | 1-2 天 |
| Phase 6 上线 | 1-2 天 |
| **总计** | **10-16 天** |

---

## 建议开发顺序

```
Phase 2（后台）
    ↓
Phase 3（对话）  ← 核心体验
    ↓
Phase 4（记忆）  ← 差异化功能
    ↓
Phase 1 + 5 + 6（收尾）
```

**理由**：
1. 先做后台 → 可以管理 API Key，后续开发不用硬编码
2. 再做对话 → 核心体验跑通
3. 再做记忆 → 产品完整
4. 最后收尾 → 用户系统、Landing、上线

---

## 文件清单（MVP 范围）

### 数据库表（8 张）

```
users           用户
conversations   对话
messages        消息
key_quotes      关键原话
api_keys        API 密钥
api_usage       用量记录
admin_users     管理员
prompts         Prompt 模板
```

### API 路由（10+ 个）

```
# 用户端
POST   /api/chat              对话（流式）
GET    /api/memory            获取记忆
POST   /api/memory/extract    提取记忆
GET    /api/conversations     对话列表
DELETE /api/conversations/[id] 删除对话

# 后台
（本次版本暂时移除，后续用 Convex 重新实现 ULW）
```

### 页面（12 个）

```
# 用户端（中英双语）
/[locale]                首页 Landing
/[locale]/chat           对话
/[locale]/history        历史
/[locale]/settings       设置

# 后台
（本次版本暂时移除，后续用 Convex 重新实现 ULW）
```

---

## 立即可以开始

你想从哪里开始？

**选项 A**：我直接输出项目初始化脚本 + 核心配置文件，你本地跑起来

**选项 B**：先出后台 API Key 管理的完整代码

**选项 C**：先出对话核心（/api/chat + UI），快速看到效果

**选项 D**：先出 Convex schema（表+索引），把数据库先建好
