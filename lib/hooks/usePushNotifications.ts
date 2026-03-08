import { useState, useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

interface PushNotificationsResult {
  permission: NotificationPermission;
  token: string | null;
  requestPermission: () => Promise<NotificationPermission>;
  registerToken: (expoToken: string) => Promise<boolean>;
  showLocalNotification: (title: string, body: string, data?: unknown) => void;
}

export function usePushNotifications(): PushNotificationsResult {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [token, setToken] = useState<string | null>(null);
  const registerPushToken = useMutation(api.guanzhao.registerPushToken);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      return 'denied';
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const registerToken = useCallback(async (expoToken: string) => {
    try {
      await registerPushToken({
        token: expoToken,
        platform: 'web',
      });
      setToken(expoToken);
      return true;
    } catch {
      return false;
    }
  }, [registerPushToken]);

  const showLocalNotification = useCallback((
    title: string,
    body: string,
    data?: unknown
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
