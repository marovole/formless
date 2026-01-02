/**
 * 观照触发器卡片组件
 * 用于显示主动触达的消息卡片
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

// =============================================
// Types
// =============================================

export interface GuanzhaoTemplate {
  id: string;
  trigger_id: string;
  style: string;
  locale: string;
  surfaces: {
    in_app: {
      title: string;
      body: string;
      buttons: Array<{
        id: string;
        label: string;
        action: string;
      }>;
    };
    push?: {
      title: string;
      body: string;
      buttons: Array<{
        id: string;
        label: string;
        action: string;
      }>;
    };
  };
}

interface GuanzhaoTriggerCardProps {
  /**
   * 模板对象
   */
  template: GuanzhaoTemplate;

  /**
   * 当用户点击按钮时的回调
   */
  onAction?: (action: string, triggerId: string) => void;

  /**
   * 当用户关闭卡片时的回调
   */
  onDismiss?: (triggerId: string) => void;

  /**
   * 是否显示关闭按钮
   */
  showCloseButton?: boolean;

  /**
   * 自动关闭延迟（毫秒）
   * 0 表示不自动关闭
   */
  autoCloseDelay?: number;
}

// =============================================
// Helper Functions
// =============================================

/**
 * 根据按钮 ID 获取按钮样式变体
 */
function getButtonVariant(buttonId: string): 'default' | 'outline' | 'ghost' | 'destructive' {
  if (buttonId === 'primary') return 'default';
  if (buttonId === 'secondary') return 'outline';
  if (buttonId === 'dismiss') return 'ghost';
  return 'outline';
}

/**
 * 根据风格获取卡片样式
 */
function getCardStyle(style: string): React.CSSProperties {
  const baseStyle: React.CSSProperties = {
    border: '1px solid',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  };

  switch (style) {
    case 'cibei': // 慈悲
      return {
        ...baseStyle,
        borderColor: 'rgb(251 191 36)', // amber-400
        background: 'linear-gradient(to bottom right, rgb(254 252 232), rgb(250 240 230))',
      };
    case 'zhizhi': // 直指
      return {
        ...baseStyle,
        borderColor: 'rgb(120 113 108)', // stone-500
        background: 'linear-gradient(to bottom right, rgb(250 250 250), rgb(241 245 249))',
      };
    case 'qingming': // 清明
    default:
      return {
        ...baseStyle,
        borderColor: 'rgb(217 119 6)', // amber-600
        background: 'linear-gradient(to bottom right, rgb(255 251 235), rgb(250 245 230))',
      };
  }
}

/**
 * 根据风格获取标题样式
 */
function getTitleStyle(style: string): React.CSSProperties {
  switch (style) {
    case 'cibei':
      return { color: 'rgb(120 53 15)' }; // amber-900
    case 'zhizhi':
      return { color: 'rgb(41 37 36)' }; // stone-900
    case 'qingming':
    default:
      return { color: 'rgb(120 53 15)' }; // amber-900
  }
}

/**
 * 根据风格获取正文样式
 */
function getBodyStyle(style: string): React.CSSProperties {
  switch (style) {
    case 'cibei':
      return { color: 'rgb(71 85 105)' }; // slate-600
    case 'zhizhi':
      return { color: 'rgb(87 83 78)' }; // stone-600
    case 'qingming':
    default:
      return { color: 'rgb(87 83 78)' }; // stone-600
  }
}

// =============================================
// Main Component
// =============================================

export function GuanzhaoTriggerCard({
  template,
  onAction,
  onDismiss,
  showCloseButton = true,
  autoCloseDelay = 0,
}: GuanzhaoTriggerCardProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const surface = template.surfaces.in_app;
  const style = template.style;

  // 自动关闭逻辑
  useEffect(() => {
    if (autoCloseDelay > 0 && !hasInteracted) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }
  }, [autoCloseDelay, hasInteracted]);

  /**
   * 处理按钮点击
   */
  const handleAction = async (button: typeof surface.buttons[0]) => {
    setHasInteracted(true);

    // 调用回调
    if (onAction) {
      onAction(button.action, template.trigger_id);
    }

    // 开始退出动画
    setIsExiting(true);

    // 延迟后隐藏组件
    setTimeout(() => {
      setIsVisible(false);
    }, 300);
  };

  /**
   * 处理关闭
   */
  const handleDismiss = () => {
    setHasInteracted(true);

    // 查找 dismiss 按钮
    const dismissButton = surface.buttons.find(b => b.id === 'dismiss');

    if (dismissButton && onAction) {
      onAction(dismissButton.action, template.trigger_id);
    } else if (onDismiss) {
      onDismiss(template.trigger_id);
    }

    setIsExiting(true);

    setTimeout(() => {
      setIsVisible(false);
    }, 300);
  };

  // 如果不可见，返回 null
  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`
        relative max-w-md mx-auto transition-all duration-300
        ${isExiting ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}
      `}
    >
      <Card
        className="overflow-hidden"
        style={getCardStyle(style)}
      >
        {/* 关闭按钮 */}
        {showCloseButton && (
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-black/5 transition-colors"
            aria-label="关闭"
          >
            <X className="w-4 h-4 text-stone-400" />
          </button>
        )}

        {/* 内容 */}
        <div className="p-6 space-y-4">
          {/* 标题 */}
          <h3
            className="text-lg font-serif font-medium leading-tight"
            style={getTitleStyle(style)}
          >
            {surface.title}
          </h3>

          {/* 正文 */}
          <p
            className="text-base leading-relaxed whitespace-pre-wrap"
            style={getBodyStyle(style)}
          >
            {surface.body}
          </p>

          {/* 按钮 */}
          <div className="flex flex-wrap gap-2 pt-2">
            {surface.buttons.map((button) => {
              // 跳过 dismiss 按钮，因为它通过关闭按钮处理
              if (button.id === 'dismiss' && showCloseButton) {
                return null;
              }

              return (
                <Button
                  key={button.id}
                  variant={getButtonVariant(button.id)}
                  onClick={() => handleAction(button)}
                  className={`
                    ${button.id === 'primary' ? 'flex-1 min-w-[120px]' : ''}
                    ${style === 'cibei' && button.id === 'primary' ? 'bg-amber-600 hover:bg-amber-700' : ''}
                    ${style === 'zhizhi' && button.id === 'primary' ? 'bg-stone-700 hover:bg-stone-800' : ''}
                  `}
                >
                  {button.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* 装饰性元素 */}
        <div className="h-1 w-full" style={{
          background: style === 'cibei'
            ? 'linear-gradient(to right, #f59e0b, #fbbf24, #f59e0b)'
            : style === 'zhizhi'
            ? 'linear-gradient(to right, #78716c, #a8a29e, #78716c)'
            : 'linear-gradient(to right, #d97706, #f59e0b, #d97706)'
        }} />
      </Card>
    </div>
  );
}

// =============================================
// Container Component
// =============================================

interface GuanzhaoTriggerContainerProps {
  /**
   * 待显示的触发器
   */
  pendingTrigger: {
    triggerId: string;
    template: GuanzhaoTemplate;
  } | null;

  /**
   * 关闭触发器
   */
  onDismiss: () => void;

  /**
   * 执行动作
   */
  onAction: (action: string, triggerId: string) => void;
}

/**
 * 触发器容器组件
 * 管理触发器的显示和动画
 */
export function GuanzhaoTriggerContainer({
  pendingTrigger,
  onDismiss,
  onAction,
}: GuanzhaoTriggerContainerProps) {
  if (!pendingTrigger) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:max-w-sm">
      <GuanzhaoTriggerCard
        template={pendingTrigger.template}
        onAction={onAction}
        onDismiss={onDismiss}
        autoCloseDelay={30000} // 30 秒后自动关闭
      />
    </div>
  );
}

// =============================================
// Toast Variant
// =============================================

interface GuanzhaoToastProps {
  template: GuanzhaoTemplate;
  onAction?: (action: string, triggerId: string) => void;
  onDismiss?: (triggerId: string) => void;
}

/**
 * 轻量级的 Toast 变体
 * 用于非侵入式的简短通知
 */
export function GuanzhaoToast({ template, onAction, onDismiss }: GuanzhaoToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const surface = template.surfaces.in_app;

  useEffect(() => {
    // 5 秒后自动关闭
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        if (onDismiss) onDismiss(template.trigger_id);
      }, 300);
    }, 5000);

    return () => clearTimeout(timer);
  }, [template.trigger_id, onDismiss]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      <Card className="px-4 py-3 shadow-lg max-w-sm">
        <p className="text-sm text-stone-700 mb-2">{surface.body}</p>
        <div className="flex gap-2">
          {surface.buttons.slice(0, 2).map((button) => (
            <Button
              key={button.id}
              size="sm"
              variant={button.id === 'primary' ? 'default' : 'outline'}
              onClick={() => onAction?.(button.action, template.trigger_id)}
            >
              {button.label}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}
