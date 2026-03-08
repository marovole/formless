import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

const DEFAULT_HEARTBEAT_INTERVAL = 60000;

interface SessionTrackingOptions {
  enabled?: boolean;
  heartbeatInterval?: number;
  pauseWhenHidden?: boolean;
}

interface TriggerResponse {
  triggerId: string;
  reason?: string;
}

interface SessionTrackingResult {
  sessionId: string | null;
  isActive: boolean;
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  sendHeartbeat: () => Promise<void>;
  handleTriggerResponse: (response: TriggerResponse) => void;
}

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

  const handleTriggerResponse = useCallback((response: TriggerResponse) => {
    window.dispatchEvent(
      new CustomEvent('guanzhao:trigger', {
        detail: {
          triggerId: response.triggerId,
          reason: response.reason,
        },
      })
    );
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const sendHeartbeat = useCallback(async () => {
    if (!sessionIdRef.current || !userId || !isActive) return;
    if (pauseWhenHidden && !isPageVisibleRef.current) return;

    try {
      const data = await handleSessionEvent({
        eventType: 'in_session',
        sessionId: sessionIdRef.current as Parameters<typeof handleSessionEvent>[0]['sessionId'],
      });

      if (data?.shouldTrigger) {
        handleTriggerResponse(data.shouldTrigger);
      }
    } catch {
      // Heartbeat errors are expected during normal operation
    }
  }, [handleSessionEvent, userId, isActive, pauseWhenHidden, handleTriggerResponse]);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    heartbeatTimerRef.current = setInterval(() => {
      sendHeartbeat();
    }, heartbeatInterval);
  }, [heartbeatInterval, sendHeartbeat, stopHeartbeat]);

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

        if (data.shouldTrigger) {
          handleTriggerResponse(data.shouldTrigger);
        }

        startHeartbeat();
      }
    } catch {
      // Session start errors are non-critical
    }
  }, [handleSessionEvent, userId, enabled, handleTriggerResponse, startHeartbeat]);

  const endSession = useCallback(async () => {
    if (!sessionIdRef.current || !userId) return;

    stopHeartbeat();

    try {
      await handleSessionEvent({
        eventType: 'session_end',
        sessionId: sessionIdRef.current as Parameters<typeof handleSessionEvent>[0]['sessionId'],
      });

      sessionIdRef.current = null;
      setSessionId(null);
      setIsActive(false);
    } catch {
      // Session end errors are non-critical
    }
  }, [handleSessionEvent, userId, stopHeartbeat]);

  useEffect(() => {
    if (!conversationId || !userId || !enabled) return;
    startSession();
  }, [conversationId, userId, enabled, startSession]);

  useEffect(() => {
    if (!pauseWhenHidden) return;

    const handleVisibilityChange = () => {
      isPageVisibleRef.current = !document.hidden;
      if (!document.hidden && isActive) {
        sendHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pauseWhenHidden, isActive, sendHeartbeat]);

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

export { useGuanzhaoTriggers } from './useGuanzhaoTriggers';
export { usePushNotifications } from './usePushNotifications';
