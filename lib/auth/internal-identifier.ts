import "server-only";

import { normalizePhoneNumber } from "./phone";

const internalAuthDomain = "phone.footballcompass.internal";

export function internalAuthIdentifierForPhone(phone: string) {
  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) {
    throw new Error("Cannot create an Auth identifier for an invalid phone number.");
  }

  return `${normalizedPhone.slice(1)}@${internalAuthDomain}`;
}
