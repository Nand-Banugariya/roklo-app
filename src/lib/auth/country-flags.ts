import { countries as supportedFlags } from "react-circle-flags";

// The default CDN used by CircleFlag; native renders the same SVG through Expo Image.
export function countryFlagUrl(code: string): string {
  const normalized = code.toLowerCase();
  return `https://react-circle-flags.pages.dev/${supportedFlags[normalized] ? normalized : "xx"}.svg`;
}
