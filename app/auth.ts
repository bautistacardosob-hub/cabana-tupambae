import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "../db";
import { userRoles } from "../db/schema";
import { createServerSupabaseClient } from "../lib/supabase/server";

export type AdminUser = { userId: string; email: string; displayName: string };

export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : "";
  if (error || !userId) return null;
  const cabinId = Number(process.env.NEXT_PUBLIC_CABIN_ID || 1);
  const [membership] = await getDb().select().from(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.cabinId, cabinId))).limit(1);
  if (!membership) return null;
  const email = typeof claims?.email === "string" ? claims.email : "";
  return { userId, email, displayName: email || "Administrador" };
}

export async function requireAdminUser(returnTo = "/admin") {
  let user: AdminUser | null = null;
  try {
    user = await getAdminUser();
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "unknown";
    console.error("No se pudo validar el acceso al administrador.", { code });
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}&error=database`);
  }
  if (user) return user;
  redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
}
