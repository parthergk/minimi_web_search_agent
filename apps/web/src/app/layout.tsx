import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Minimi",
  description: "Minimal conversational AI with web search",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
