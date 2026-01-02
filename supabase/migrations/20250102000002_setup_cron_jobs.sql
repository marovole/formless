-- =============================================
-- 观照系统定时任务配置
-- =============================================
--
-- 用途：配置 pg_cron 定时任务，定期检查并触发观照消息
--
-- 前提条件：
-- 1. 在 Supabase Dashboard 启用 pg_cron 扩展
-- 2. 确保 Edge Functions 已部署
--
-- 执行方式：
-- 1. 登录 Supabase Dashboard
-- 2. 进入 SQL Editor
-- 3. 执行本脚本
-- =============================================

-- 启用 pg_cron 扩展（如果尚未启用）
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =============================================
-- 定时任务 1: 每 5 分钟检查节律型触发器
-- =============================================
--
-- 检查：daily_checkin、nightly_wrapup、overload_protection
-- 执行时间：每 5 分钟
--
SELECT cron.schedule(
  'guanzhao-check-rhythm-triggers',           -- 任务名称
  '*/5 * * * *',                              -- 每 5 分钟执行一次
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/guanzhao/trigger-engine',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'task', 'check_rhythm_triggers',
        'timestamp', now()
      )
    );
  $$
);

-- =============================================
-- 定时任务 2: 每天 UTC 00:00 重置预算
-- =============================================
--
-- 重置：每日预算计数器
-- 执行时间：每天 UTC 00:00
--
SELECT cron.schedule(
  'guanzhao-reset-daily-budget',              -- 任务名称
  '0 0 * * *',                                -- 每天 UTC 00:00
  $$
  UPDATE guanzhao_budget_tracking
  SET
    used_in_app_day = 0,
    used_push_day = 0,
    last_reset_at = NOW()
  WHERE enabled = true;
  $$
);

-- =============================================
-- 定时任务 3: 每周一 UTC 00:00 重置周预算
-- =============================================
--
-- 重置：每周预算计数器
-- 执行时间：每周一 UTC 00:00
--
SELECT cron.schedule(
  'guanzhao-reset-weekly-budget',             -- 任务名称
  '0 0 * * 1',                                -- 每周一 UTC 00:00
  $$
  UPDATE guanzhao_budget_tracking
  SET
    used_in_app_week = 0,
    used_push_week = 0
  WHERE enabled = true;
  $$
);

-- =============================================
-- 定时任务 4: 每小时清理过期冷却记录
-- =============================================
--
-- 清理：超过 7 天的冷却记录
-- 执行时间：每小时
--
SELECT cron.schedule(
  'guanzhao-cleanup-cooldowns',               -- 任务名称
  '0 * * * *',                                -- 每小时
  $$
  DELETE FROM guanzhao_cooldowns
  WHERE cooldown_until < NOW() - INTERVAL '7 days';
  $$
);

-- =============================================
-- 定时任务 5: 每天清理旧会话记录
-- =============================================
--
-- 清理：超过 30 天的会话记录
-- 执行时间：每天 UTC 02:00
--
SELECT cron.schedule(
  'guanzhao-cleanup-old-sessions',            -- 任务名称
  '0 2 * * *',                                -- 每天 UTC 02:00
  $$
  DELETE FROM user_sessions
  WHERE started_at < NOW() - INTERVAL '30 days';
  $$
);

-- =============================================
-- 查看已配置的定时任务
-- =============================================
SELECT
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
WHERE jobname LIKE 'guanzhao-%'
ORDER BY jobid;

-- =============================================
-- 查看定时任务执行历史（最近 10 条）
-- =============================================
SELECT
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid IN (
  SELECT jobid FROM cron.job WHERE jobname LIKE 'guanzhao-%'
)
ORDER BY start_time DESC
LIMIT 10;

-- =============================================
-- 删除定时任务（如需重新配置）
-- =============================================
-- 取消注释以下代码以删除所有观照系统定时任务：
--
-- SELECT cron.unschedule('guanzhao-check-rhythm-triggers');
-- SELECT cron.unschedule('guanzhao-reset-daily-budget');
-- SELECT cron.unschedule('guanzhao-reset-weekly-budget');
-- SELECT cron.unschedule('guanzhao-cleanup-cooldowns');
-- SELECT cron.unschedule('guanzhao-cleanup-old-sessions');

-- =============================================
-- 使用说明
-- =============================================
--
-- 1. 配置环境变量（在 Supabase Dashboard）：
--    - app.settings.supabase_url: 您的 Supabase 项目 URL
--    - app.settings.service_role_key: 服务密钥
--
-- 2. 手动触发测试：
--    可以使用以下命令手动测试触发器引擎：
--
--    SELECT net.http_post(
--      url := 'YOUR_SUPABASE_URL/functions/v1/guanzhao/trigger-engine',
--      headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_KEY"}'::jsonb,
--      body := '{"task": "check_rhythm_triggers"}'::jsonb
--    );
--
-- 3. 监控任务执行：
--    定期检查 cron.job_run_details 表以确保任务正常运行
--
-- =============================================
