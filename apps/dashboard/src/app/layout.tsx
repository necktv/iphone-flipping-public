import './globals.css';
import React from 'react';

export const metadata = {
  title: 'iPhone Flipping Command Center',
  description: 'Sistema di analisi e flipping multi-marketplace per iPhone',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body className="bg-[#0f172a] text-slate-100 font-sans min-h-screen">
        <div className="container mx-auto">{children}</div>
      </body>
    </html>
  );
}
