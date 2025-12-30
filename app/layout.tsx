import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ORGanize TAMU',
  description: 'Find your perfect organization match at Texas A&M University',
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

