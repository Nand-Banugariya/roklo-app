import type { ReactNode } from 'react';
import { ActivityIndicator } from 'react-native';

import { Button, type ButtonProps } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useRokloTheme } from '@/hooks/use-roklo-theme';
import { cn } from '@/lib/utils';

export type CustomButtonVariant = 'primary' | 'secondary' | 'outline' | 'soft' | 'ghost' | 'destructive' | 'destructive-solid' | 'link';
export type CustomButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface CustomButtonProps extends Omit<ButtonProps, 'variant' | 'size' | 'children'> {
  variant?: CustomButtonVariant;
  size?: CustomButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  loadingText?: ReactNode;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  children?: ReactNode;
}

export function CustomButton({
  variant = 'primary', size = 'md', fullWidth, loading, loadingText,
  leadingIcon, trailingIcon, children, className, disabled, accessibilityState, ...props
}: CustomButtonProps) {
  const { colors } = useRokloTheme();
  const indicatorColor = variant === 'primary' ? colors['primary-foreground']
    : variant === 'destructive-solid' ? colors['on-solid']
    : variant === 'destructive' ? colors['error-fg'] : colors.primary;
  return (
    <Button {...props} variant={variant === 'primary' ? 'default' : variant}
      size={size === 'md' ? 'default' : size} disabled={disabled || loading}
      accessibilityState={{ ...accessibilityState, disabled: !!disabled || !!loading, busy: !!loading }}
      className={cn(fullWidth && 'w-full', loading && !disabled && 'opacity-100', variant === 'link' && 'min-h-11', className)}>
      {loading ? <ActivityIndicator size="small" color={indicatorColor} /> : leadingIcon}
      <Text>{loading && loadingText != null ? loadingText : children}</Text>
      {!loading && trailingIcon}
    </Button>
  );
}
