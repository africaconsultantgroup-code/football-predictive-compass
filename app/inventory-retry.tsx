"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function InventoryRetry() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button className="secondary-button inventory-retry" type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())}>{pending ? "Checking fixtures…" : "Retry fixtures"}</button>;
}
