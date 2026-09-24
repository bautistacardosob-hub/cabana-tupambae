"use client";

import { FormEvent, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";

export function LoginForm({ returnTo, databaseUnavailable = false }: { returnTo: string; databaseUnavailable?: boolean }) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (params.get("error_code") === "otp_expired") {
      setError("Ese enlace de invitación ya venció o fue usado. Pedí un enlace nuevo para crear tu contraseña.");
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const { error: authError } = await createBrowserSupabaseClient().auth.signInWithPassword({
      email: String(form.get("email") || ""), password: String(form.get("password") || ""),
    });
    if (authError) { setError("Email o contraseña incorrectos."); setBusy(false); return; }
    window.location.assign(returnTo);
  }
  async function recoverPassword() {
    const emailInput = document.querySelector<HTMLInputElement>('input[name="email"]');
    const email = emailInput?.value.trim() || "";
    if (!email || !emailInput?.checkValidity()) {
      emailInput?.reportValidity();
      return;
    }
    setRecovering(true); setError(""); setMessage("");
    const redirectTo = `${window.location.origin}/auth/callback?next=/update-password`;
    const { error: recoveryError } = await createBrowserSupabaseClient().auth.resetPasswordForEmail(email, { redirectTo });
    if (recoveryError) {
      setError("No pudimos enviar el enlace. Esperá un momento y volvé a intentarlo.");
    } else {
      setMessage("Te enviamos un enlace para crear una contraseña nueva. Revisá también Spam o Promociones.");
    }
    setRecovering(false);
  }
  return <main className="loginPage"><section className="loginCard"><span className="eyebrow">ADMINISTRADOR</span><h1>Ingresar a la cabaña</h1><p>Administrá contenido, animales, remates y galería.</p>{databaseUnavailable&&<p role="alert">No se pudo conectar con la base de datos. Revisá la variable DATABASE_URL en Netlify.</p>}<form onSubmit={submit}><label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Contraseña<input name="password" type="password" autoComplete="current-password" required /></label>{error&&<p role="alert">{error}</p>}{message&&<p className="loginNotice" role="status">{message}</p>}<button disabled={busy||recovering}>{busy?"Ingresando…":"Ingresar"}</button><button className="loginSecondary" type="button" disabled={busy||recovering} onClick={recoverPassword}>{recovering?"Enviando…":"Crear o recuperar contraseña"}</button></form><a href="/">← Volver al sitio</a></section></main>;
}
