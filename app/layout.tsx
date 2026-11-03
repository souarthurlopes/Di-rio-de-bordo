import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Diário de Bordo | Gestão",
  description: "Diários de bordo e acompanhamentos de equipe",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
