import { useColorScheme as useNativewindColorScheme } from 'nativewind';

export function useColorScheme() {
  return useNativewindColorScheme().colorScheme;
}
