import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Better Stats",
  description: "Better Stats web app",
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
