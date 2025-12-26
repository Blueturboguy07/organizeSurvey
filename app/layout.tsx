import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TAMU Survey',
  description: 'Texas A&M University Survey',
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

