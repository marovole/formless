# Supabase → Convex.dev 迁移完成

## 已完成的工作

### 1. 依赖安装
- `convex` - Convex 数据库和函数
- `@clerk/nextjs` - Clerk 认证

### 2. Convex 项目配置
- `convex.json` - Convex 项目配置
- `convex/schema.ts` - 数据库 Schema 定义（11张表）

### 3. Convex 函数实现
| 文件 | 功能 |
|------|------|
| `convex/conversations.ts` | 对话 CRUD |
| `convex/messages.ts` | 消息 CRUD |
| `convex/memory.ts` | 记忆系统 |
| `convex/users.ts` | 用户管理 |
| `convex/admin.ts` | 后台管理（API Keys, Prompts） |
| `convex/guanzhao/settings.ts` | 观照设置 |
| `convex/guanzhao/budget.ts` | 预算管理 |
| `convex/guanzhao/triggers.ts` | 触发器管理 |
| `convex/guanzhao/actions.ts` | 观照操作 |

### 4. 前端集成
- `app/ConvexClientProvider.tsx` - Convex + Clerk Provider
- `lib/convex/client.ts` - Convex 客户端
- `lib/clerk.ts` - Clerk 工具函数
- `lib/hooks/useAuth.ts` - 更新为使用 Clerk
- `middleware.ts` - 添加 Clerk 中间件
- `app/[locale]/layout.tsx` - 使用 ConvexClientProvider

### 5. 环境变量
- `.env.example` - 已添加 Convex 和 Clerk 配置项

---

## 下一步（手动操作）

### 1. 创建 Convex 项目
```bash
npx convex dev
```
这会：
- 要求登录 Convex 账户
- 创建新的 Convex 项目
- 生成 `NEXT_PUBLIC_CONVEX_URL` 环境变量

### 2. 创建 Clerk 应用
1. 访问 https://clerk.com
2. 创建新的 Clerk 应用
3. 获取 `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` 和 `CLERK_SECRET_KEY`

### 3. 配置 Clerk 重定向
在 Clerk Dashboard 中配置：
- Sign-in: `/sign-in`
- Sign-up: `/sign-up`
- After sign-in: `/chat`
- After sign-out: `/`

### 4. 创建登录/注册页面
需要创建以下页面（目前缺失）：
- `app/sign-in/page.tsx`
- `app/sign-up/page.tsx`

参考 Clerk Next.js 文档创建这些页面。

### 5. 部署 Convex
```bash
npx convex deploy
```

---

## 文件清单

### 新建文件
```
convex/
├── schema.ts
├── conversations.ts
├── messages.ts
├── memory.ts
├── users.ts
├── admin.ts
└── guanzhao/
    ├── settings.ts
    ├── budget.ts
    ├── triggers.ts
    └── actions.ts

app/
├── ConvexClientProvider.tsx
└── api/convex/           # 可选（Convex 直接连接）

lib/
├── convex/client.ts
└── clerk.ts

middleware.ts             # 已修改
.env.example              # 已修改
```

### 待创建（未包含在迁移中）
```
app/sign-in/page.tsx
app/sign-up/page.tsx
```

---

## 迁移状态检查清单

- [ ] Convex 项目已创建
- [ ] Clerk 应用已配置
- [ ] 环境变量已设置
- [ ] 登录/注册页面已创建
- [ ] `npx convex dev` 运行正常
- [ ] Clerk 登录/登出正常
- [ ] 对话功能测试通过
- [ ] 记忆功能测试通过
- [ ] 观照系统测试通过
