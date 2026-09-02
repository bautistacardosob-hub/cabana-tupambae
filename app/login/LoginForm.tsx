"use client";

import { FormEvent, useState } from "react";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";

export function LoginForm({ returnTo, databaseUnavailable = false }: { returnTo: string; databaseUnavailable?: boolean }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const { error: authError } = await createBrowserSupabaseClient().auth.signInWithPassword({
      email: String(form.get("email") || ""), password: String(form.get("password") || ""),
    });
    if (authError) { setError("Email o contraseña incorrectos."); setBusy(false); return; }
    window.location.assign(returnTo);
  }
  return <main className="loginPage"><section className="loginCard"><span className="eyebrow">ADMINISTRADOR</span><h1>Ingresar a la cabaña</h1><p>Administrá contenido, animales, remates y galería.</p>{databaseUnavailable&&<p role="alert">No se pudo conectar con la base de datos. Revisá la variable DATABASE_URL en Netlify.</p>}<form onSubmit={submit}><label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Contraseña<input name="password" type="password" autoComplete="current-password" required /></label>{error&&<p role="alert">{error}</p>}<button disabled={busy}>{busy?"Ingresando…":"Ingresar"}</button></form><a href="/">← Volver al sitio</a></section></main>;
}
