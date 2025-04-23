import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/utils"
import Link from "next/link"
import { Plus, Edit, Trash } from "lucide-react"
import { DataTable } from "@/components/data-table"
import { deleteUser } from "@/app/actions/users"

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  // Check if user is admin
  const isAdmin = session.user.roles.includes("admin")
  if (!isAdmin) {
    redirect("/dashboard")
  }

  // Get all users
  const users = await db.user.findMany({
    include: {
      roles: true,
    },
    orderBy: {
      lastName: "asc",
    },
  })

  // Get all roles for the form
  const roles = await db.role.findMany({
    orderBy: {
      name: "asc",
    },
  })

  // Format users for the table
  const formattedUsers = users.map((user) => ({
    id: user.id,
    name: `${user.lastName} ${user.firstName} ${user.middleName || ""}`,
    email: user.email,
    position: user.position,
    department: user.department,
    roles: user.roles.map((role) => role.name).join(", "),
    lastLogin: user.lastLogin ? formatDate(user.lastLogin) : "Никогда",
    isActive: user.isActive ? "Активен" : "Неактивен",
  }))

  // Define columns for the table
  const columns = [
    {
      accessorKey: "name",
      header: "ФИО",
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "position",
      header: "Должность",
    },
    {
      accessorKey: "department",
      header: "Отдел",
    },
    {
      accessorKey: "roles",
      header: "Роли",
    },
    {
      accessorKey: "lastLogin",
      header: "Последний вход",
    },
    {
      accessorKey: "isActive",
      header: "Статус",
    },
    {
      id: "actions",
      cell: ({ row }: { row: { original: { id: string } } }) => {
        const userId = row.original.id

        return (
          <div className="flex items-center space-x-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/users/${userId}`}>
                <Edit className="h-4 w-4 mr-1" />
                Изменить
              </Link>
            </Button>
            <form action={deleteUser}>
              <input type="hidden" name="userId" value={userId} />
              <Button size="sm" variant="destructive" type="submit">
                <Trash className="h-4 w-4 mr-1" />
                Удалить
              </Button>
            </form>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Управление пользователями</h1>
        <Button asChild>
          <Link href="/admin/users/create">
            <Plus className="mr-2 h-4 w-4" />
            Добавить пользователя
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Пользователи</CardTitle>
          <CardDescription>Список всех пользователей системы</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={formattedUsers} />
        </CardContent>
      </Card>
    </div>
  )
}
