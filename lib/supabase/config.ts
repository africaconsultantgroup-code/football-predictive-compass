export function getPublicSupabaseConfig(
  environment: Record<string, string | undefined> = process.env,
) {
  const url = environment.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Missing required public Supabase configuration.");
  }

  return { url, publishableKey };
}
