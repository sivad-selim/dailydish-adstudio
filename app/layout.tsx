import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DailyDish Ad Studio",
  description: "Créez des publicités DailyDish homogènes et prêtes pour Instagram.",
  icons: {
    icon: "/brand/logo-transparent.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
