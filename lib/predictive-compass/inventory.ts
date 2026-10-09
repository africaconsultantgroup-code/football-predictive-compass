export type InventoryDiagnostic = "INVENTORY_AVAILABLE" | "CORE_EMPTY" | "CORE_TIMEOUT" | "CORE_REQUEST_FAILED" | "DTO_PARSE_FAILED" | "ACCESS_CHECK_FAILED" | "FILTERED_TO_ZERO";

export function inventoryFailure(error: unknown): InventoryDiagnostic {
  const kind = error && typeof error === "object" && "kind" in error ? error.kind : undefined;
  return kind === "timeout" ? "CORE_TIMEOUT" : kind === "malformed" || (error instanceof Error && error.name === "ZodError") ? "DTO_PARSE_FAILED" : "CORE_REQUEST_FAILED";
}

// Log reason codes only: never API keys, upstream bodies or paid forecast data.
export function reportInventory(source: "premium" | "free" | "access" | "filter", code: InventoryDiagnostic, count = 0) {
  console.info("[customer-inventory]", { source, code, count });
}

export function canonicalCompetition(name: string) {
  const aliases: Record<string, string> = { EPL: "Premier League", PL: "Premier League", "English Premier League": "Premier League", UCL: "UEFA Champions League", CL: "UEFA Champions League", "Champions League": "UEFA Champions League" };
  return aliases[name.trim()] ?? name.trim();
}
