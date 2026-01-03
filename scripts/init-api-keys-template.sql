-- =============================================
-- Formless API Keys 安全模板
-- 用于修复现有表结构并插入 API Keys
-- 执行位置: Supabase Dashboard SQL Editor
--
-- ⚠️ 安全说明：
-- 1. 此文件不包含实际密钥，仅为模板
-- 2. 使用前请从环境变量或密钥管理器获取实际密钥
-- 3. 切勿将实际密钥提交到版本控制系统
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

-- 步骤 4: 插入 OpenRouter API Key
-- ⚠️ 重要：将 'YOUR_OPENROUTER_API_KEY_HERE' 替换为实际密钥
INSERT INTO api_keys (provider, key, model_name, daily_limit, priority)
VALUES (
  'openrouter',
  'YOUR_OPENROUTER_API_KEY_HERE',  -- ⚠️ 请替换为实际密钥
  'anthropic/claude-3-5-sonnet',
  1000,
  1
);

-- 步骤 5: 插入 Chutes API Key
-- ⚠️ 重要：将 'YOUR_CHUTES_API_KEY_HERE' 替换为实际密钥
INSERT INTO api_keys (provider, key, model_name, daily_limit, priority)
VALUES (
  'chutes',
  'YOUR_CHUTES_API_KEY_HERE',  -- ⚠️ 请替换为实际密钥
  'gpt-4o',
  1000,
  1
);

-- 步骤 6: 验证插入结果
SELECT 'API Keys 插入结果:' as info;
SELECT id, provider, model_name, daily_limit, priority, is_active FROM api_keys;

SELECT 'Formless API Keys 配置完成！' as status;
