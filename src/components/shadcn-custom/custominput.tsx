import type { ComponentProps } from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type CustomInputSize = 'sm' | 'md' | 'lg' | 'xl';
export interface CustomInputProps extends ComponentProps<typeof Input> {
  size?: CustomInputSize;
  invalid?: boolean;
}

const SIZE = { sm: 'h-8 text-[13px]', md: 'h-9 text-sm', lg: 'h-10 text-sm', xl: 'h-12 rounded-lg text-base' };

export function CustomInput({ size = 'md', invalid, className, ...props }: CustomInputProps) {
  return <Input className={cn(SIZE[size], invalid && 'border-error-fg bg-error-bg-2 focus:border-error-fg', className)} {...props} />;
}
