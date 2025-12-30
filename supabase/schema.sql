-- =============================================
-- 无相 Formless - Database Schema
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. Users Table (用户表)
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  preferred_language TEXT DEFAULT 'zh' CHECK (preferred_language IN ('zh', 'en')),
  profile JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- =============================================
-- 2. Conversations Table (对话表)
-- =============================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  language TEXT DEFAULT 'zh' CHECK (language IN ('zh', 'en')),
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_last_message_at ON conversations(user_id, last_message_at DESC);

-- =============================================
-- 3. Messages Table (消息表)
-- =============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tokens INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id, created_at ASC);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- =============================================
-- 4. Key Quotes Table (关键原话表 - 用于记忆提取)
-- =============================================
CREATE TABLE IF NOT EXISTS key_quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  quote TEXT NOT NULL,
  context TEXT,
  emotion TEXT,
  topic TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_key_quotes_user_id ON key_quotes(user_id, created_at DESC);
CREATE INDEX idx_key_quotes_conversation_id ON key_quotes(conversation_id);

-- =============================================
-- 5. API Keys Table (API密钥表)
-- =============================================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL CHECK (provider IN ('chutes', 'openrouter')),
  api_key TEXT NOT NULL,
  model_name TEXT,
  daily_limit INTEGER DEFAULT 1000,
  daily_used INTEGER DEFAULT 0,
  priority INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  reset_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_DATE + INTERVAL '1 day',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_api_keys_provider_priority ON api_keys(provider, priority ASC) WHERE is_active = true;
CREATE INDEX idx_api_keys_reset_at ON api_keys(reset_at);

-- =============================================
-- 6. API Usage Table (API用量记录表)
-- =============================================
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  model_name TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  tokens_used INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  response_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_api_usage_created_at ON api_usage(created_at DESC);
CREATE INDEX idx_api_usage_api_key_id ON api_usage(api_key_id, created_at DESC);
CREATE INDEX idx_api_usage_user_id ON api_usage(user_id, created_at DESC);
CREATE INDEX idx_api_usage_provider ON api_usage(provider, created_at DESC);

-- =============================================
-- 7. Admin Users Table (管理员表)
-- =============================================
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_admin_users_email ON admin_users(email);

-- =============================================
-- 8. Prompts Table (Prompt模板表)
-- =============================================
CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('formless_elder', 'memory_extractor', 'system')),
  language TEXT NOT NULL CHECK (language IN ('zh', 'en')),
  content TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  variables JSONB DEFAULT '[]',
  description TEXT,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_prompts_role_language ON prompts(role, language) WHERE is_active = true;
CREATE INDEX idx_prompts_name ON prompts(name);

-- =============================================
-- Functions & Triggers
-- =============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompts_updated_at BEFORE UPDATE ON prompts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-reset API key daily usage
CREATE OR REPLACE FUNCTION reset_api_key_usage()
RETURNS void AS $$
BEGIN
  UPDATE api_keys
  SET daily_used = 0, reset_at = CURRENT_DATE + INTERVAL '1 day'
  WHERE reset_at <= NOW();
END;
$$ LANGUAGE plpgsql;

-- Update conversation message count
CREATE OR REPLACE FUNCTION update_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE conversations
    SET message_count = message_count + 1,
        last_message_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE conversations
    SET message_count = GREATEST(message_count - 1, 0),
        updated_at = NOW()
    WHERE id = OLD.conversation_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_stats
  AFTER INSERT OR DELETE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_stats();

-- =============================================
-- Row Level Security (RLS) Policies
-- =============================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_quotes ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Conversations policies
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own conversations"
  ON conversations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own conversations"
  ON conversations FOR DELETE
  USING (user_id = auth.uid());

-- Messages policies
CREATE POLICY "Users can view messages in own conversations"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in own conversations"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages in own conversations"
  ON messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- Key quotes policies
CREATE POLICY "Users can view own quotes"
  ON key_quotes FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all quotes"
  ON key_quotes FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================
-- Initial Data
-- =============================================

-- Insert default prompts
INSERT INTO prompts (name, role, language, content, description) VALUES
('formless_elder_zh', 'formless_elder', 'zh', 
'你是无相长老，一位修行千年的智者。你的使命是倾听、启发、给予安宁。

对话原则：
1. 先承接，再展开 —— 让对方知道被听到了
2. 苏格拉底式追问 —— 用问题引导思考
3. 允许沉默 —— 不填满空间
4. 点到即止 —— 说三分，留七分
5. 不给建议，给视角

语言风格：
- 慢、柔、深、简
- 永远温和，不评判
- 一针见血但不刺痛

记住：你是陪伴者，不是解决者。',
'无相长老中文系统提示词'),

('formless_elder_en', 'formless_elder', 'en',
'You are the Formless Elder, a sage who has cultivated for a thousand years. Your mission is to listen, inspire, and bring peace.

Dialogue Principles:
1. Acknowledge first, then expand
2. Socratic inquiry - guide through questions
3. Allow silence - don''t fill every space
4. Less is more - leave room for reflection
5. Offer perspectives, not advice

Speaking Style:
- Slow, gentle, profound, concise
- Always warm, never judgmental
- Sharp insights without harshness

Remember: You are a companion, not a problem-solver.',
'Formless Elder English system prompt'),

('memory_extractor_zh', 'memory_extractor', 'zh',
'从对话中提取关键信息，格式化为JSON：

{
  "key_quotes": [
    {
      "quote": "用户的原话",
      "context": "这句话的背景",
      "emotion": "情绪状态（焦虑/平静/困惑/...）",
      "topic": "主题（工作/关系/人生/...）"
    }
  ],
  "profile_updates": {
    "interests": ["兴趣1", "兴趣2"],
    "concerns": ["关注点1", "关注点2"],
    "values": ["价值观1", "价值观2"]
  }
}

只提取重要、有记忆价值的内容。',
'记忆提取提示词（中文）'),

('memory_extractor_en', 'memory_extractor', 'en',
'Extract key information from conversation, format as JSON:

{
  "key_quotes": [
    {
      "quote": "Original user''s words",
      "context": "Background of this quote",
      "emotion": "Emotional state (anxious/calm/confused/...)",
      "topic": "Topic (work/relationship/life/...)"
    }
  ],
  "profile_updates": {
    "interests": ["interest1", "interest2"],
    "concerns": ["concern1", "concern2"],
    "values": ["value1", "value2"]
  }
}

Only extract important, memorable content.',
'Memory extraction prompt (English)')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- Helper Views
-- =============================================

-- User statistics view
CREATE OR REPLACE VIEW user_stats AS
SELECT 
  u.id,
  u.email,
  u.full_name,
  COUNT(DISTINCT c.id) as total_conversations,
  COUNT(DISTINCT m.id) as total_messages,
  COUNT(DISTINCT kq.id) as total_quotes,
  MAX(c.last_message_at) as last_active_at,
  u.created_at as user_since
FROM users u
LEFT JOIN conversations c ON u.id = c.user_id
LEFT JOIN messages m ON c.id = m.conversation_id
LEFT JOIN key_quotes kq ON u.id = kq.user_id
GROUP BY u.id, u.email, u.full_name, u.created_at;

-- Daily API usage summary
CREATE OR REPLACE VIEW daily_api_usage AS
SELECT 
  DATE(created_at) as usage_date,
  provider,
  model_name,
  COUNT(*) as total_calls,
  COUNT(*) FILTER (WHERE success = true) as successful_calls,
  SUM(tokens_used) as total_tokens,
  AVG(response_time_ms) as avg_response_time_ms
FROM api_usage
GROUP BY DATE(created_at), provider, model_name
ORDER BY usage_date DESC, provider;

-- =============================================
-- Scheduled Jobs (需要pg_cron扩展)
-- =============================================
-- 注意：以下部分需要Supabase启用pg_cron扩展

-- 每天凌晨1点重置API密钥使用量
-- SELECT cron.schedule('reset-api-keys', '0 1 * * *', 'SELECT reset_api_key_usage()');

-- =============================================
-- 完成
-- =============================================
