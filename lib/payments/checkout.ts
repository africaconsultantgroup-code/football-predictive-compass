import "server-only";

import { z } from "zod";

const checkoutRequestSchema = z.object({ product_id: z.string().uuid() }).strict();

export function parseCheckoutRequest(value: unknown) {
  return checkoutRequestSchema.safeParse(value);
}
