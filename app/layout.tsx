import type React from "react"
import type { Metadata } from "next"
import localFont from "next/font/local"
import { UserProvider } from "@/components/providers/user-provider"
import { NavigationProgress } from "@/components/ui/navigation-progress"
import "./globals.css"

// Self-hosted to remove the build-time fetch to fonts.gstatic.com (which fails
// on networks without outbound Google Fonts access). Files live in app/fonts/.
// Variable names are unchanged (--font-geist / --font-manrope) so globals.css
// (--font-sans / --font-serif) keeps resolving exactly as before.
const geist = localFont({
  src: "./fonts/geist/Geist-Variable.woff2",
  display: "swap",
  variable: "--font-geist",
  weight: "100 900",
})

const manrope = localFont({
  src: "./fonts/manrope/Manrope-Variable.ttf",
  display: "swap",
  variable: "--font-manrope",
  weight: "200 800",
})

export const metadata: Metadata = {
  title: "Cagayan Valley Smart City Academy",
  description:
    "A learning platform that empowers LGUs, academe, students, and private individuals to co-create Smart and Sustainable Communities",
  icons: {
    icon: '/DOST02.ico',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${manrope.variable} antialiased`}>
      <body className="font-sans">
        <NavigationProgress />
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  )
}
