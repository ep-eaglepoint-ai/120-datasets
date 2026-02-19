import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Study Planner - Offline-First Learning Tracker',
  description: 'Track your study sessions, manage subjects, and maintain study streaks with a fully offline-first study planner.',
  keywords: ['study planner', 'learning tracker', 'offline-first', 'productivity'],
  authors: [{ name: 'Study Planner Team' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#0ea5e9',
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
      </head>
      <body>{children}</body>
    </html>
  );
}
