import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Diário de Bordo",
  description:
    "Formulários diário, semanal e mensal de acompanhamento do líder",
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
