import { PrismaClient } from "@prisma/client"

declare global {
  var cachedPrisma: PrismaClient
}

let db: PrismaClient

// Проверяем, что мы не в процессе сборки
if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE === "phase-production-build") {
  // Во время сборки возвращаем заглушку вместо реального клиента
  db = {} as PrismaClient
} else {
  if (!global.cachedPrisma) {
    global.cachedPrisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    })
  }
  db = global.cachedPrisma
}

export { db }

export async function connectToDatabase() {
  // Проверяем, что мы не в процессе сборки
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE === "phase-production-build") {
    console.log("Skipping database connection during build")
    return {} as PrismaClient
  }

  try {
    await db.$connect()
    console.log("✅ Database connected successfully")
    return db
  } catch (error) {
    console.error("❌ Database connection error:", error)
    throw error
  }
}
