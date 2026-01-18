# 观照系统 Agent 指南

本文件适用于 `lib/guanzhao/` 目录及其子目录。

## 业务规则（必须遵守）

1. **配置源**：`docs/guanzhao/guanzhao-bundle.yaml` 是配置源文件，`guanzhao-bundle.json` 为生成产物，修改配置优先改 YAML。
2. **模板选择**：按 `trigger.template_sets.by_style[user.style]` 选择；缺失时用 `fallback_style`；候选模板需做去重轮转。
3. **占位符**：时间窗占位符格式为 `{{user.xxx|DEFAULT}}`，解析不到时用默认值。
4. **预算与抑制**：每次触达消耗 `trigger.budget_cost[channel]`，预算不足跳过；`global_rules.suppression` 生效；`crisis_high_risk` 可绕过预算。

## 关联实现

- Convex 逻辑：`convex/guanzhao.ts`
- 配置包：`docs/guanzhao/guanzhao-bundle.yaml`
