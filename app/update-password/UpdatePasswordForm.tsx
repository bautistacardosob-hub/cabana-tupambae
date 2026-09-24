"use client";

import { FormEvent, useState } from "react";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";

export function UpdatePasswordForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("confirmation") || "");
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres."); setBusy(false); return;
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden."); setBusy(false); return;
    }
    const { error: updateError } = await createBrowserSupabaseClient().auth.updateUser({ password });
    if (updateError) {
      setError("El enlace venció o no es válido. Volvé al ingreso y pedí uno nuevo."); setBusy(false); return;
    }
    window.location.assign("/admin");
  }

  return <main className="loginPage"><section className="loginCard"><span className="eyebrow">ADMINISTRADOR</span><h1>Crear contraseña</h1><p>Elegí una contraseña personal para administrar Cabaña Tupambaé.</p><form onSubmit={submit}><label>Nueva contraseña<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label><label>Repetir contraseña<input name="confirmation" type="password" autoComplete="new-password" minLength={8} required /></label>{error&&<p role="alert">{error}</p>}<button disabled={busy}>{busy?"Guardando…":"Guardar y entrar"}</button></form><a href="/login?returnTo=%2Fadmin">← Volver al ingreso</a></section></main>;
}
