# 观照（大师人格）配置包

面向工程的“模板库 + 触发配置”一体化文件：

- `docs/guanzhao/guanzhao-bundle.yaml`：可读性优先（建议作为源文件）
- `docs/guanzhao/guanzhao-bundle.json`：机器消费版（由 YAML 生成）

## 结构概览

- `defaults`：默认开关/频率/风格/渠道/免打扰
- `frequency_levels`：静默/清简/中道/精进的预算（按 `per_day / per_week`）
- `actions`：按钮动作 ID → 工程动作（打开 flow / 静默 / 设置项等）
- `templates`：话术模板（按 `trigger_id + style + locale`）
- `triggers`：触发配置（入口事件、时间窗、冷却/次数、push 约束、模板集）

## 模板选择（建议实现）

1) 先选 `trigger.template_sets.by_style[user.style]`，若不存在则用 `fallback_style`；  
2) 在候选模板中随机/轮转（建议同一用户做去重轮转）；  
3) 渲染模板时执行变量替换（见下一节）。

## 占位符约定

触发配置的时间窗允许用简易占位符字符串（工程侧解析即可）：

- `{{user.xxx|DEFAULT}}`：读取用户配置 `user.xxx`，若为空则使用 `DEFAULT`

示例：`{{user.guanzhao.checkin_window_start|09:00}}`。

## 预算与抑制（建议实现）

- 预算：按用户 `frequency_level` 获取 `budgets`，每次触达消耗 `trigger.budget_cost[channel]`；不足则跳过。
- 全局抑制：`global_rules.suppression`（关闭、静默中、push 免打扰）。
- 安全流：`crisis_high_risk.in_app.constraints.bypass_frequency_budgets = true` 时不受预算影响。

## JSON 生成

如需从 YAML 重新生成 JSON：

```bash
python3 - <<'PY'
import json
from pathlib import Path
import yaml
data = yaml.safe_load(Path('docs/guanzhao/guanzhao-bundle.yaml').read_text(encoding='utf-8'))
Path('docs/guanzhao/guanzhao-bundle.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
PY
```
