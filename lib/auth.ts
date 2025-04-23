import { compare } from "bcryptjs"
import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

// Динамический импорт для предотвращения проблем во время сборки
export const authOptions: NextAuthOptions = {
  // Используем адаптер только если не в процессе сборки
  adapter: undefined, // Мы будем использовать JWT вместо адаптера для упрощения
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Введите email и пароль")
        }

        try {
          // Динамический импорт для предотвращения проблем во время сборки
          const { db } = await import("./db")

          const user = await db.user.findUnique({
            where: {
              email: credentials.email,
            },
            include: {
              roles: {
                include: {
                  permissions: true,
                },
              },
            },
          })

          if (!user) {
            throw new Error("Пользователь не найден")
          }

          if (!user.isActive) {
            throw new Error("Учетная запись отключена")
          }

          const isPasswordValid = await compare(credentials.password, user.password)

          if (!isPasswordValid) {
            throw new Error("Неверный пароль")
          }

          // Update last login time
          await db.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
          })

          // Log login action
          await db.auditLog.create({
            data: {
              userId: user.id,
              action: "LOGIN",
              entity: "USER",
              entityId: user.id,
              details: { ip: "127.0.0.1" }, // В реальном приложении вы бы получили реальный IP
            },
          })

          return {
            id: user.id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            roles: user.roles.map((role) => role.name),
            permissions: user.roles.flatMap((role) => role.permissions.map((p) => p.name)),
            image: user.photoUrl,
          }
        } catch (error) {
          console.error("Ошибка авторизации:", error)
          throw new Error(error instanceof Error ? error.message : "Ошибка авторизации")
        }
      },
    }),
  ],
  callbacks: {
    async session({ token, session }) {
      if (token) {
        session.user.id = token.id as string
        session.user.name = token.name
        session.user.email = token.email
        session.user.roles = token.roles as string[]
        session.user.permissions = token.permissions as string[]
        session.user.image = token.image as string | null
      }

      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.roles = user.roles
        token.permissions = user.permissions
        token.image = user.image
      }

      return token
    },
  },
  debug: process.env.NODE_ENV === "development",
}
