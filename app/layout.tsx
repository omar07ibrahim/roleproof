import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { SessionProvider } from "@/components/session-provider"

const inter = Inter({ subsets: ["latin", "cyrillic"] })

export const metadata: Metadata = {
  title: "AeroCRM - Система управления сотрудниками и документами",
  description: "Система управления сотрудниками и документами для РГП Казаэронавигация",
    generator: 'v0.dev'
}

// Инициализация базы данных будет происходить через API роут, а не при сборке
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Проверяем, что мы не в процессе сборки
  let session = null
  if (!(process.env.NODE_ENV === "production" && process.env.NEXT_PHASE === "phase-production-build")) {
    session = await getServerSession(authOptions)
  }

  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={inter.className}>
        <SessionProvider session={session}>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            {children}
            <Toaster />
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
