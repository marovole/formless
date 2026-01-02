-- =============================================
-- 修复版：观照（Guanzhao）主动 Agent 系统数据库架构
-- Migration: 20250102000001_guanzhao_system_fixed
-- =============================================
-- 修复说明：
-- 1. 修复 increment_session_message_count() 函数中的 ORDER BY 语法错误
-- 2. 添加 IF NOT EXISTS 检查避免重复创建
-- 3. 使用 DO $$ 块安全创建 Triggers 和 Policies
-- =============================================

-- =============================================
-- 1. User Sessions Table (用户会话表)
-- =============================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  duration_minutes INTEGER,
  messages_count INTEGER DEFAULT 0,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_started_at ON user_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(user_id, last_activity_at DESC);

-- =============================================
-- 2. Guanzhao Trigger History (触发历史表)
-- =============================================
CREATE TABLE IF NOT EXISTS guanzhao_trigger_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trigger_id TEXT NOT NULL,
  template_id TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'push')),
  status TEXT DEFAULT 'shown' CHECK (status IN ('shown', 'clicked', 'dismissed', 'error')),
  action_taken TEXT,
  feedback TEXT CHECK (feedback IN ('useful', 'not_fit', 'too_frequent', 'not_relevant')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guanzhao_history_user_id ON guanzhao_trigger_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guanzhao_history_trigger_id ON guanzhao_trigger_history(trigger_id);
CREATE INDEX IF NOT EXISTS idx_guanzhao_history_channel ON guanzhao_trigger_history(channel);

-- =============================================
-- 3. Guanzhao Budget Tracking (预算追踪表)
-- =============================================
CREATE TABLE IF NOT EXISTS guanzhao_budget_tracking (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  frequency_level TEXT DEFAULT 'qingjian' CHECK (frequency_level IN ('silent', 'qingjian', 'zhongdao', 'jingjin')),

  -- 预算配置（从 frequency_levels 读取）
  budget_in_app_day INTEGER DEFAULT 1,
  budget_in_app_week INTEGER DEFAULT 2,
  budget_push_day INTEGER DEFAULT 0,
  budget_push_week INTEGER DEFAULT 0,

  -- 已使用量
  used_in_app_day INTEGER DEFAULT 0,
  used_in_app_week INTEGER DEFAULT 0,
  used_push_day INTEGER DEFAULT 0,
  used_push_week INTEGER DEFAULT 0,

  -- 周期追踪
  current_period_start DATE DEFAULT CURRENT_DATE,
  week_start DATE DEFAULT DATE_TRUNC('week', CURRENT_DATE),

  -- 静默状态
  snoozed_until TIMESTAMP WITH TIME ZONE,

  -- 设置（存储在 users.profile 中，这里做冗余以便快速查询）
  enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT false,
  dnd_start TEXT DEFAULT '23:30',
  dnd_end TEXT DEFAULT '08:00',
  style TEXT DEFAULT 'qingming' CHECK (style IN ('qingming', 'cibei', 'zhizhi')),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guanzhao_budget_frequency ON guanzhao_budget_tracking(frequency_level);

-- =============================================
-- 4. Guanzhao Cooldowns (冷却表)
-- =============================================
CREATE TABLE IF NOT EXISTS guanzhao_cooldowns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trigger_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'push')),
  cooldown_until TIMESTAMP WITH TIME ZONE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guanzhao_cooldowns_user_trigger ON guanzhao_cooldowns(user_id, trigger_id);
CREATE INDEX IF NOT EXISTS idx_guanzhao_cooldowns_until ON guanzhao_cooldowns(cooldown_until);

-- =============================================
-- 5. Push Tokens (推送令牌表)
-- =============================================
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_id TEXT,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);

-- =============================================
-- 6. Safety Screening Logs (风险检测日志表)
-- =============================================
CREATE TABLE IF NOT EXISTS safety_screening_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  message_content TEXT,
  risk_level TEXT CHECK (risk_level IN ('none', 'low', 'medium', 'high', 'crisis')),
  matched_keywords TEXT[],
  api_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_safety_logs_user_id ON safety_screening_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_safety_logs_risk_level ON safety_screening_logs(risk_level);
CREATE INDEX IF NOT EXISTS idx_safety_logs_conversation ON safety_screening_logs(conversation_id);

-- =============================================
-- Functions & Triggers
-- =============================================

-- 更新 updated_at 字段的触发器
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_guanzhao_budget_tracking_updated_at') THEN
    CREATE TRIGGER update_guanzhao_budget_tracking_updated_at
      BEFORE UPDATE ON guanzhao_budget_tracking
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_push_tokens_updated_at') THEN
    CREATE TRIGGER update_push_tokens_updated_at
      BEFORE UPDATE ON push_tokens
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 预算重置函数
CREATE OR REPLACE FUNCTION reset_guanzhao_budgets()
RETURNS void AS $$
BEGIN
  -- 重置每日预算
  UPDATE guanzhao_budget_tracking
  SET used_in_app_day = 0,
      used_push_day = 0,
      current_period_start = CURRENT_DATE
  WHERE current_period_start < CURRENT_DATE;

  -- 重置每周预算
  UPDATE guanzhao_budget_tracking
  SET used_in_app_week = 0,
      used_push_week = 0,
      week_start = DATE_TRUNC('week', CURRENT_DATE)
  WHERE week_start < DATE_TRUNC('week', CURRENT_DATE);

  -- 清理过期的冷却记录
  DELETE FROM guanzhao_cooldowns
  WHERE cooldown_until < NOW();
END;
$$ LANGUAGE plpgsql;

-- 更新用户会话持续时间
CREATE OR REPLACE FUNCTION update_session_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
    NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at)) / 60;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_session_duration') THEN
    CREATE TRIGGER update_user_session_duration
      BEFORE UPDATE ON user_sessions
      FOR EACH ROW EXECUTE FUNCTION update_session_duration();
  END IF;
END $$;

-- ✅ 修复版：更新会话消息计数（使用 DECLARE 变量避免 ORDER BY 在 UPDATE 中的问题）
CREATE OR REPLACE FUNCTION increment_session_message_count()
RETURNS TRIGGER AS $$
DECLARE
  target_session_id UUID;
  target_user_id UUID;
BEGIN
  -- 首先获取用户 ID
  SELECT user_id INTO target_user_id
  FROM conversations
  WHERE id = NEW.conversation_id;

  -- 如果找不到对话，直接返回
  IF target_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 查找该用户最近的活跃会话
  SELECT id INTO target_session_id
  FROM user_sessions
  WHERE user_id = target_user_id
    AND ended_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1;

  -- 如果找到活跃会话，更新它
  IF target_session_id IS NOT NULL THEN
    UPDATE user_sessions
    SET messages_count = messages_count + 1,
        last_activity_at = NOW()
    WHERE id = target_session_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_increment_session_message_count') THEN
    CREATE TRIGGER trigger_increment_session_message_count
      AFTER INSERT ON messages
      FOR EACH ROW EXECUTE FUNCTION increment_session_message_count();
  END IF;
END $$;

-- 检查用户是否在 DND 时段
CREATE OR REPLACE FUNCTION is_user_in_dnd(user_id UUID, check_time TIMESTAMP WITH TIME ZONE DEFAULT NOW())
RETURNS BOOLEAN AS $$
DECLARE
  dnd_start TEXT;
  dnd_end TEXT;
  check_time_local TIME;
  start_time TIME;
  end_time TIME;
BEGIN
  SELECT bt.dnd_start, bt.dnd_end INTO dnd_start, dnd_end
  FROM guanzhao_budget_tracking bt
  WHERE bt.user_id = is_user_in_dnd.user_id;

  IF dnd_start IS NULL OR dnd_end IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 转换为用户时区时间（简单实现，假设 UTC）
  check_time_local := check_time::TIME;
  start_time := dnd_start::TIME;
  end_time := dnd_end::TIME;

  -- 处理跨午夜的情况
  IF start_time < end_time THEN
    RETURN check_time_local >= start_time AND check_time_local < end_time;
  ELSE
    -- 跨午夜，如 23:30 到 08:00
    RETURN check_time_local >= start_time OR check_time_local < end_time;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Helper Views
-- =============================================

-- 触发统计视图
CREATE OR REPLACE VIEW guanzhao_trigger_stats AS
SELECT
  user_id,
  trigger_id,
  channel,
  COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_count,
  COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE)) as week_count,
  COUNT(*) FILTER (WHERE status = 'clicked') as clicked_count,
  COUNT(*) FILTER (WHERE status = 'dismissed') as dismissed_count,
  MAX(created_at) as last_triggered_at
FROM guanzhao_trigger_history
GROUP BY user_id, trigger_id, channel;

-- 会话统计视图
CREATE OR REPLACE VIEW user_session_stats AS
SELECT
  user_id,
  COUNT(*) as total_sessions,
  SUM(messages_count) as total_messages,
  AVG(duration_minutes) as avg_duration_minutes,
  MAX(started_at) as last_session_at,
  SUM(CASE WHEN DATE(started_at) = CURRENT_DATE THEN 1 ELSE 0 END) as sessions_today
FROM user_sessions
WHERE ended_at IS NOT NULL
GROUP BY user_id;

-- =============================================
-- Row Level Security (RLS) Policies
-- =============================================

-- Enable RLS on all new tables
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE guanzhao_trigger_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE guanzhao_budget_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE guanzhao_cooldowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_screening_logs ENABLE ROW LEVEL SECURITY;

-- User sessions policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own sessions') THEN
    CREATE POLICY "Users can view own sessions"
      ON user_sessions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage all sessions') THEN
    CREATE POLICY "Service role can manage all sessions"
      ON user_sessions FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Trigger history policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own trigger history') THEN
    CREATE POLICY "Users can view own trigger history"
      ON guanzhao_trigger_history FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage all trigger history') THEN
    CREATE POLICY "Service role can manage all trigger history"
      ON guanzhao_trigger_history FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Budget tracking policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own budget') THEN
    CREATE POLICY "Users can view own budget"
      ON guanzhao_budget_tracking FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own budget') THEN
    CREATE POLICY "Users can insert own budget"
      ON guanzhao_budget_tracking FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own budget') THEN
    CREATE POLICY "Users can update own budget"
      ON guanzhao_budget_tracking FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage all budgets') THEN
    CREATE POLICY "Service role can manage all budgets"
      ON guanzhao_budget_tracking FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Cooldowns policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own cooldowns') THEN
    CREATE POLICY "Users can view own cooldowns"
      ON guanzhao_cooldowns FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage all cooldowns') THEN
    CREATE POLICY "Service role can manage all cooldowns"
      ON guanzhao_cooldowns FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Push tokens policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own push tokens') THEN
    CREATE POLICY "Users can manage own push tokens"
      ON push_tokens FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage all push tokens') THEN
    CREATE POLICY "Service role can manage all push tokens"
      ON push_tokens FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Safety logs policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own safety logs') THEN
    CREATE POLICY "Users can view own safety logs"
      ON safety_screening_logs FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage all safety logs') THEN
    CREATE POLICY "Service role can manage all safety logs"
      ON safety_screening_logs FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- =============================================
-- Initial Data - Create budget tracking for existing users
-- =============================================

-- 使用 WHERE NOT EXISTS 避免重复插入
INSERT INTO guanzhao_budget_tracking (user_id)
SELECT id FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM guanzhao_budget_tracking WHERE guanzhao_budget_tracking.user_id = users.id
);

-- =============================================
-- 完成
-- =============================================
