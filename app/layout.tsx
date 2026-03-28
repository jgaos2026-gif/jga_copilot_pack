import './globals.css';

export const metadata = {
  title: 'JGA Enterprise OS',
  description: 'Enterprise Operating System for Secure Business Operations',
};

export const metadata: Metadata = {
  title: 'JGA Enterprise OS',
  description: 'Enterprise Operating System for JGA',
  viewport: 'width=device-width, initial-scale=1',
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