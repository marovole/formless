-- =============================================
-- Formless API Keys 修复脚本
-- 用于修复现有表结构并插入 API Keys
-- 执行位置: Supabase Dashboard SQL Editor
-- =============================================

-- 步骤 1: 检查并添加缺失的列
DO $$
BEGIN
    -- 检查 key 列是否存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'api_keys' AND column_name = 'key'
    ) THEN
        -- 尝试添加 api_key 列（如果实际列名不同）
        BEGIN
            ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS api_key TEXT;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END;
    END IF;

    -- 检查 model_name 列是否存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'api_keys' AND column_name = 'model_name'
    ) THEN
        ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS model_name TEXT;
    END IF;

    -- 检查 priority 列是否存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'api_keys' AND column_name = 'priority'
    ) THEN
        ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 1;
    END IF;
END $$;

-- 步骤 2: 更新 api_keys 表的约束
ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_provider_check;
ALTER TABLE api_keys ADD CONSTRAINT api_keys_provider_check
    CHECK (provider IN ('chutes', 'openrouter'));

-- 步骤 3: 删除已存在的相同 provider 的记录
DELETE FROM api_keys WHERE provider = 'openrouter';
DELETE FROM api_keys WHERE provider = 'chutes';

-- 步骤 4: 插入 OpenRouter API Key（使用 key 列名）
INSERT INTO api_keys (provider, key, model_name, daily_limit, priority)
VALUES (
  'openrouter',
  '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',
  'anthropic/claude-3-5-sonnet',
  1000,
  1
);

-- 步骤 5: 插入 Chutes API Key（使用 key 列名）
INSERT INTO api_keys (provider, key, model_name, daily_limit, priority)
VALUES (
  'chutes',
  'cpk_527e360eba2f4e80b850fad74ba0bf97.d25dffafe20651659df8e055d37c22d1.leE2JBoXyopdpJKmi7ck4HMk2ZX1GiZD',
  'gpt-4o',
  1000,
  1
);

-- 步骤 6: 验证插入结果
SELECT 'API Keys 插入结果:' as info;
SELECT id, provider, model_name, daily_limit, priority, is_active FROM api_keys;

SELECT 'Formless API Keys 配置完成！' as status;
