import { ActivityIndicator, type ActivityIndicatorProps } from 'react-native';

import { useRokloTheme } from '@/hooks/use-roklo-theme';

export function CustomSpinner(props: ActivityIndicatorProps) {
  const { colors } = useRokloTheme();
  return <ActivityIndicator color={colors.primary} accessibilityLabel="Loading" {...props} />;
}
