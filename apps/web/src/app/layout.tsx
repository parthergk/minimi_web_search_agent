import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Minimi Web Search Agent',
  description: 'AI-powered web search agent monorepo',
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

