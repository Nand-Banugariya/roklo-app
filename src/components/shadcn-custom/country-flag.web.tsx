import { CircleFlag } from "react-circle-flags";

import { getCountry } from "@/lib/auth/countries";

export function CountryFlag({ code, size = 20 }: { code: string; size?: number }) {
  return (
    <CircleFlag
      countryCode={code.toLowerCase()}
      width={size}
      height={size}
      alt={`${getCountry(code).name} flag`}
      style={{ flexShrink: 0 }}
    />
  );
}
