import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { Pressable } from '@/components/ui/pressable';

import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';

// React Native Reusables Button, customized to Roklo's web variants.
const buttonVariants = cva('flex-row items-center justify-center gap-1.5 rounded-md border border-transparent', {
  variants: {
    variant: {
      default: 'border-primary bg-primary active:border-brand-700 active:bg-brand-700',
      secondary: 'border-border bg-card active:bg-ink-75',
      outline: 'border-primary bg-transparent active:bg-brand-50',
      soft: 'border-brand-200 bg-brand-50 active:bg-brand-100',
      ghost: 'bg-transparent active:bg-ink-100',
      destructive: 'border-error-border-strong bg-card active:bg-error-bg',
      'destructive-solid': 'border-error-solid bg-error-solid active:bg-error-solid-hover',
      link: 'border-0 bg-transparent',
    },
    size: {
      default: 'h-9 px-3', xs: 'h-7 rounded-segment px-2.5', sm: 'h-8 px-2.5',
      lg: 'h-10 px-4', xl: 'h-12 rounded-lg px-4', icon: 'h-11 w-11 p-0',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

const buttonTextVariants = cva('font-sans-medium text-sm', {
  variants: {
    variant: {
      default: 'text-primary-foreground', secondary: 'text-ink-900', outline: 'text-primary',
      soft: 'font-sans-semibold text-brand-800', ghost: 'text-ink-700', destructive: 'text-error-fg',
      'destructive-solid': 'text-on-solid', link: 'text-primary underline',
    },
    size: {
      default: '', xs: 'text-xs', sm: 'text-[13px]', lg: '',
      xl: 'font-sans-semibold text-[15px]', icon: '',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

export type ButtonProps = ComponentProps<typeof Pressable> & VariantProps<typeof buttonVariants>;

function Button({ className, variant = 'default', size = 'default', disabled, ...props }: ButtonProps) {
  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
      <Pressable role="button" disabled={disabled}
        className={cn(buttonVariants({ variant, size }), disabled && 'opacity-50', className)} {...props} />
    </TextClassContext.Provider>
  );
}

export { Button, buttonVariants, buttonTextVariants };
