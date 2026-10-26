import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, type ViewProps } from 'react-native';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

export type CustomAlertTone = 'info' | 'success' | 'warning' | 'error';
const TONE = {
  info: { icon: Info, box: 'border-info-border bg-info-bg', text: 'text-info-fg' },
  success: { icon: CircleCheck, box: 'border-brand-200 bg-success-bg', text: 'text-success-fg' },
  warning: { icon: TriangleAlert, box: 'border-warning-border bg-warning-bg', text: 'text-warning-fg' },
  error: { icon: CircleAlert, box: 'border-error-border bg-error-bg', text: 'text-error-fg' },
};

export interface CustomAlertProps extends ViewProps {
  tone?: CustomAlertTone;
  title?: string;
  children?: ReactNode;
  onDismiss?: () => void;
}

export function CustomAlert({ tone = 'info', title, children, onDismiss, className, ...props }: CustomAlertProps) {
  const style = TONE[tone];
  return (
    <Alert icon={style.icon} iconClassName={style.text} role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
      accessibilityLiveRegion="polite" className={cn(style.box, onDismiss && 'pr-11', className)} {...props}>
      {title && <AlertTitle className={style.text}>{title}</AlertTitle>}
      {children != null && <AlertDescription className={style.text}>{children}</AlertDescription>}
      {onDismiss && (
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onDismiss}
          className="absolute right-0 top-0 h-11 w-11 items-center justify-center">
          <Icon as={X} size={16} className={style.text} />
        </Pressable>
      )}
    </Alert>
  );
}
