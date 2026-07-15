import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Role = Profile["role"];

// Signed-in user + their profile, for server components and actions.
// Returns null when not signed in (proxy.ts normally prevents that) or when
// the profile row is missing (should not happen — provisioned by trigger).
export async function getUserProfile(): Promise<{
  userId: string;
  email: string | undefined;
  profile: Profile;
} | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  return { userId: user.id, email: user.email, profile };
}
