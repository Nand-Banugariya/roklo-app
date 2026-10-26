import { Image } from "expo-image";

import { countryFlagUrl } from "@/lib/auth/country-flags";
import { getCountry } from "@/lib/auth/countries";

export function CountryFlag({
  code,
  size = 20,
}: {
  code: string;
  size?: number;
}) {
  return (
    <Image
      source={{ uri: countryFlagUrl(code) }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      contentFit="contain"
      accessibilityLabel={`${getCountry(code).name} flag`}
    />
  );
}
