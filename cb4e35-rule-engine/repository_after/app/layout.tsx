import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Rule Engine - Personal Laws',
  description: 'Define your own laws as IF-THEN rules',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
