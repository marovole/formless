/**
 * 会话追踪 Hook
 * 用于追踪用户会话的开始、结束和活动事件
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Template } from '@/lib/guanzhao/types';

// =============================================
// Types
// =============================================

interface SessionTrackingOptions {
  /**
   * 是否启用会话追踪
   */
  enabled?: boolean;

  /**
   * 活动心跳间隔（毫秒）
   */
  heartbeatInterval?: number;

  /**
   * 是否在页面隐藏时暂停追踪
   */
  pauseWhenHidden?: boolean;
}

interface SessionTrackingResult {
  /**
   * 当前会话 ID
   */
  sessionId: string | null;

  /**
   * 会话是否活跃
   */
  isActive: boolean;

  /**
   * 手动触发会话开始
   */
  startSession: () => Promise<void>;

  /**
   * 手动触发会话结束
   */
  endSession: () => Promise<void>;

  /**
   * 发送心跳活动信号
   */
  sendHeartbeat: () => Promise<void>;

  /**
   * 处理触发器响应
   */
  handleTriggerResponse: (response: TriggerResponse) => void;
}

interface TriggerResponse {
  triggerId: string;
  reason?: string;
}

// =============================================
// Constants
// =============================================

const DEFAULT_HEARTBEAT_INTERVAL = 60000; // 1 分钟

// =============================================
// Main Hook
// =============================================

export function useSessionTracking(
  conversationId: string | null,
  options: SessionTrackingOptions = {}
): SessionTrackingResult {
  const {
    enabled = true,
    heartbeatInterval = DEFAULT_HEARTBEAT_INTERVAL,
    pauseWhenHidden = true,
  } = options;

  const { userId } = useAuth();
  const handleSessionEvent = useMutation(api.guanzhao.handleSessionEvent);
  const sessionIdRef = useRef<string | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPageVisibleRef = useRef(true);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);

  /**
   * 处理触发器响应
   */
  const handleTriggerResponse = useCallback((response: TriggerResponse) => {
    // 这个函数应该调用触发引擎来获取模板
    // 然后显示触发器卡片

    console.log('Trigger response:', response);

    // 触发自定义事件，让聊天页面处理
    window.dispatchEvent(
      new CustomEvent('guanzhao:trigger', {
        detail: {
          triggerId: response.triggerId,
          reason: response.reason,
        },
      })
    );
  }, []);

  /**
   * 停止心跳定时器
   */
  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  /**
   * 发送心跳
   */
  const sendHeartbeat = useCallback(async () => {
    if (!sessionIdRef.current || !userId || !isActive) return;

    // 如果页面隐藏且配置了暂停，则跳过
    if (pauseWhenHidden && !isPageVisibleRef.current) {
      return;
    }

    try {
      const data = await handleSessionEvent({
        eventType: 'in_session',
        sessionId: sessionIdRef.current as any,
      });

      if (data?.shouldTrigger) {
        handleTriggerResponse(data.shouldTrigger);
      }
    } catch (error) {
      console.error('Error sending heartbeat:', error);
    }
  }, [handleSessionEvent, userId, isActive, pauseWhenHidden, handleTriggerResponse]);

  /**
   * 启动心跳定时器
   */
  const startHeartbeat = useCallback(() => {
    stopHeartbeat();

    heartbeatTimerRef.current = setInterval(() => {
      sendHeartbeat();
    }, heartbeatInterval);
  }, [heartbeatInterval, sendHeartbeat, stopHeartbeat]);

  /**
   * 开始新会话
   */
  const startSession = useCallback(async () => {
    if (!userId || !enabled) return;

    try {
      const data = await handleSessionEvent({
        eventType: 'session_start',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      if (data?.success && data.sessionId) {
        sessionIdRef.current = String(data.sessionId);
        setSessionId(String(data.sessionId));
        setIsActive(true);

        // 如果有触发器响应，处理它
        if (data.shouldTrigger) {
          handleTriggerResponse(data.shouldTrigger);
        }

        // 启动心跳
        startHeartbeat();
      }
    } catch (error) {
      console.error('Error starting session:', error);
    }
  }, [handleSessionEvent, userId, enabled, handleTriggerResponse, startHeartbeat]);

  /**
   * 结束会话
   */
  const endSession = useCallback(async () => {
    if (!sessionIdRef.current || !userId) return;

    // 停止心跳
    stopHeartbeat();

    try {
      await handleSessionEvent({
        eventType: 'session_end',
        sessionId: sessionIdRef.current as any,
      });

      sessionIdRef.current = null;
      setSessionId(null);
      setIsActive(false);
    } catch (error) {
      console.error('Error ending session:', error);
    }
  }, [handleSessionEvent, userId, stopHeartbeat]);

  // =============================================
  // Lifecycle
  // =============================================

  useEffect(() => {
    if (!conversationId || !userId || !enabled) {
      return;
    }

    // 开始会话
    startSession();

    // 清理函数
    return () => {
      // 不在卸载时结束会话，因为用户可能只是在切换页面
      // 会话应该在页面卸载或用户离开时结束
    };
  }, [conversationId, userId, enabled, startSession]);

  // 处理页面可见性变化
  useEffect(() => {
    if (!pauseWhenHidden) return;

    const handleVisibilityChange = () => {
      isPageVisibleRef.current = !document.hidden;

      // 如果页面重新可见，立即发送一次心跳
      if (!document.hidden && isActive) {
        sendHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pauseWhenHidden, isActive, sendHeartbeat]);

  // 页面卸载时结束会话
  useEffect(() => {
    const handleBeforeUnload = () => {
      void endSession();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      void endSession();
    };
  }, [endSession]);

  return {
    sessionId,
    isActive,
    startSession,
    endSession,
    sendHeartbeat,
    handleTriggerResponse,
  };
}

// =============================================
// Utility Hook: Trigger State
// =============================================

/**
 * 管理触发器状态的 Hook
 */
export function useGuanzhaoTriggers() {
  const [pendingTrigger, setPendingTrigger] = useState<{
    triggerId: string;
    template: Template;
  } | null>(null);

  const [dismissedTriggers, setDismissedTriggers] = useState<Set<string>>(new Set());

  /**
   * 显示触发器
   */
  const showTrigger = useCallback((triggerId: string, template: Template) => {
    if (!dismissedTriggers.has(triggerId)) {
      setPendingTrigger({ triggerId, template });
    }
  }, [dismissedTriggers]);

  /**
   * 关闭触发器
   */
  const dismissTrigger = useCallback((_triggerId?: string) => {
    setPendingTrigger(null);
  }, []);

  /**
   * 永久关闭某个触发器（本次会话）
   */
  const permanentlyDismiss = useCallback((triggerId: string) => {
    setDismissedTriggers((prev) => new Set([...prev, triggerId]));
    setPendingTrigger(null);
  }, []);

  return {
    pendingTrigger,
    showTrigger,
    dismissTrigger,
    permanentlyDismiss,
  };
}

// =============================================
// Utility Hook: Push Notifications
// =============================================

/**
 * 推送通知管理 Hook
 */
export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [token, setToken] = useState<string | null>(null);
  const registerPushToken = useMutation(api.guanzhao.registerPushToken);

  /**
   * 请求推送权限
   */
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return 'denied';
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  /**
   * 注册推送令牌
   */
  const registerToken = useCallback(async (expoToken: string) => {
    try {
      await registerPushToken({
        token: expoToken,
        platform: 'web',
      });
      setToken(expoToken);
      return true;
    } catch (error) {
      console.error('Error registering push token:', error);
      return false;
    }
  }, [registerPushToken]);

  /**
   * 显示本地通知
   */
  const showLocalNotification = useCallback((
    title: string,
    body: string,
    data?: NotificationOptions['data']
  ) => {
    if (permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/icon-192.png',
        data,
      });
    }
  }, [permission]);

  return {
    permission,
    token,
    requestPermission,
    registerToken,
    showLocalNotification,
  };
}
