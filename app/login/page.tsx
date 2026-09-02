import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; error?: string }> }) {
  const params = await searchParams;
  const returnTo = params.returnTo;
  return <LoginForm
    returnTo={returnTo?.startsWith("/") ? returnTo : "/admin"}
    databaseUnavailable={params.error === "database"}
  />;
}
