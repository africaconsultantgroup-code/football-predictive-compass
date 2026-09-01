export type SupportedPhoneCountry = "GH";

const countryCallingCodes: Record<SupportedPhoneCountry, string> = {
  GH: "233",
};

export function normalizePhoneNumber(
  input: string,
  country: SupportedPhoneCountry = "GH",
): string | null {
  const compact = input.trim().replace(/[\s().-]/g, "");
  if (!compact) return null;

  let digits: string;
  if (compact.startsWith("+")) {
    digits = compact.slice(1);
  } else if (compact.startsWith("00")) {
    digits = compact.slice(2);
  } else if (country === "GH" && /^0\d{9}$/.test(compact)) {
    digits = `${countryCallingCodes[country]}${compact.slice(1)}`;
  } else {
    return null;
  }

  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return `+${digits}`;
}
