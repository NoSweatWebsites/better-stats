import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BetterStats',
  description: 'Analytics dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
