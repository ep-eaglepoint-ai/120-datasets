import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import './globals.css';

export const metadata: Metadata = {
  title: 'Form Generator',
  description: 'Form builder and generator',
  keywords: 'Survey Form Research meteyik mtk',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
