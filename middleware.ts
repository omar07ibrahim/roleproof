import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Продолжаем обработку запроса
  return NextResponse.next()
}

// Указываем, что middleware должен выполняться только для определенных путей
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/init-db (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api/init-db|_next/static|_next/image|favicon.ico).*)",
  ],
}
