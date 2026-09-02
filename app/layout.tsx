import type { Metadata } from "next";
import { getPublicIdentity } from "../lib/site-identity";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const identity=await getPublicIdentity();
  const title = `${identity.brandName} — Genética y producción`;
  const description = identity.description;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary", title, description },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
