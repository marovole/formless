import { useState, useCallback } from 'react';
import type { Template } from '@/lib/guanzhao/types';

interface PendingTrigger {
  triggerId: string;
  template: Template;
}

interface GuanzhaoTriggersResult {
  pendingTrigger: PendingTrigger | null;
  showTrigger: (triggerId: string, template: Template) => void;
  dismissTrigger: (triggerId?: string) => void;
  permanentlyDismiss: (triggerId: string) => void;
}

export function useGuanzhaoTriggers(): GuanzhaoTriggersResult {
  const [pendingTrigger, setPendingTrigger] = useState<PendingTrigger | null>(null);
  const [dismissedTriggers, setDismissedTriggers] = useState<Set<string>>(new Set());

  const showTrigger = useCallback((triggerId: string, template: Template) => {
    if (!dismissedTriggers.has(triggerId)) {
      setPendingTrigger({ triggerId, template });
    }
  }, [dismissedTriggers]);

  const dismissTrigger = useCallback((_triggerId?: string) => {
    setPendingTrigger(null);
  }, []);

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
