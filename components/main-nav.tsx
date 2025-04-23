"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"
import { Search } from "@/components/search"

export function MainNav() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const isAdmin = session?.user?.roles?.includes("admin")
  const isManager = session?.user?.roles?.includes("manager")

  const routes = [
    {
      href: "/dashboard",
      label: "Главная",
      active: pathname === "/dashboard",
    },
    {
      href: "/documents",
      label: "Документы",
      active: pathname === "/documents" || pathname.startsWith("/documents/"),
    },
    {
      href: "/vacations",
      label: "Отпуска",
      active: pathname === "/vacations",
    },
    {
      href: "/trainings",
      label: "Обучения",
      active: pathname === "/trainings",
    },
    {
      href: "/notifications",
      label: "Уведомления",
      active: pathname === "/notifications",
    },
  ]

  const adminRoutes = [
    {
      href: "/admin/users",
      label: "Пользователи",
      active: pathname === "/admin/users" || pathname.startsWith("/admin/users/"),
    },
    {
      href: "/admin/roles",
      label: "Роли",
      active: pathname === "/admin/roles" || pathname.startsWith("/admin/roles/"),
    },
    {
      href: "/admin/document-types",
      label: "Типы документов",
      active: pathname === "/admin/document-types" || pathname.startsWith("/admin/document-types/"),
    },
  ]

  const managerRoutes = [
    {
      href: "/admin/vacations",
      label: "Управление отпусками",
      active: pathname === "/admin/vacations",
    },
    {
      href: "/admin/trainings",
      label: "Управление обучениями",
      active: pathname === "/admin/trainings",
    },
  ]

  return (
    <nav className="flex items-center space-x-4 lg:space-x-6">
      <Link href="/dashboard" className="flex items-center space-x-2">
        <span className="font-bold text-xl">AeroCRM</span>
      </Link>
      <div className="flex items-center space-x-4 lg:space-x-6">
        {routes.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className={cn(
              "text-sm font-medium transition-colors hover:text-primary",
              route.active ? "text-primary" : "text-muted-foreground",
            )}
          >
            {route.label}
          </Link>
        ))}
        {isAdmin &&
          adminRoutes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                route.active ? "text-primary" : "text-muted-foreground",
              )}
            >
              {route.label}
            </Link>
          ))}
        {(isAdmin || isManager) &&
          managerRoutes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                route.active ? "text-primary" : "text-muted-foreground",
              )}
            >
              {route.label}
            </Link>
          ))}
      </div>
      <div className="hidden md:block ml-auto">
        <Search placeholder="Поиск..." />
      </div>
    </nav>
  )
}
