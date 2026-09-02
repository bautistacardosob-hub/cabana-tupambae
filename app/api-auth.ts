import { getAdminUser } from "./auth";

export async function requireApiUser() {
  const user = await getAdminUser();
  if (user) return null;
  return Response.json({ error: "Tenés que iniciar sesión para administrar esta página." }, { status: 401 });
}
