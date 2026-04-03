import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Jay's Graphic Arts — Enterprise OS",
  description:
    'JGA Enterprise OS: secure, compliant business operations for Jay\'s Graphic Arts LLC.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body className="antialiased">
        <div className="min-h-screen bg-gray-50">
          {children}
        </div>
      </body>
    </html>
  );
}