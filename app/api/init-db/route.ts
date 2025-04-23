import { NextResponse } from "next/server"

// Динамический импорт для предотвращения проблем во время сборки
export async function GET() {
  // Проверяем, что мы не в процессе сборки
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE === "phase-production-build") {
    return NextResponse.json({ success: false, message: "Cannot initialize database during build" })
  }

  try {
    // Динамический импорт для предотвращения проблем во время сборки
    const { initializeDatabase } = await import("@/lib/init-db")
    await initializeDatabase()
    return NextResponse.json({ success: true, message: "Database initialized successfully" })
  } catch (error) {
    console.error("Error initializing database:", error)
    return NextResponse.json(
      { success: false, message: "Failed to initialize database", error: String(error) },
      { status: 500 },
    )
  }
}
