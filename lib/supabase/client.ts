import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

// Browser-side Supabase client. One instance per component tree is fine —
// createBrowserClient deduplicates internally.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
