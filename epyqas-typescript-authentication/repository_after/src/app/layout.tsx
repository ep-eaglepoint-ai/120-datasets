import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auth From Scratch",
  description: "A minimal authentication system built from scratch with Next.js and TypeScript.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
