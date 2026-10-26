import { ChevronLeft } from 'lucide-react-native';

import { CustomButton, type CustomButtonProps } from '@/components/shadcn-custom/custombutton';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

export function CustomBackButton({ children = 'Back', className, ...props }: Omit<CustomButtonProps, 'variant' | 'size' | 'leadingIcon'>) {
  return (
    <CustomButton variant="ghost" size="sm" leadingIcon={<Icon as={ChevronLeft} size={16} />}
      className={cn('-ml-2 min-h-11 self-start rounded-md pl-1.5 pr-2.5', className)} {...props}>
      {children}
    </CustomButton>
  );
}
