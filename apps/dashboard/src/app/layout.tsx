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
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
