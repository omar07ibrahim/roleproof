import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate } from "@/lib/utils"
import Link from "next/link"
import { Plus } from "lucide-react"

export default async function DocumentsPage() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const userId = session.user.id

  // Get user's documents
  const myDocuments = await db.document.findMany({
    where: {
      uploaderId: userId,
    },
    orderBy: {
      updatedAt: "desc",
    },
  })

  // Get documents assigned to user
  const assignedDocuments = await db.documentAssignment.findMany({
    where: {
      userId,
    },
    include: {
      document: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  })

  // Check if user can create documents
  const canCreateDocuments =
    session.user.permissions.includes("create:documents") ||
    session.user.roles.includes("admin") ||
    session.user.roles.includes("manager")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Документы</h1>
        {canCreateDocuments && (
          <Button asChild>
            <Link href="/documents/create">
              <Plus className="mr-2 h-4 w-4" />
              Создать документ
            </Link>
          </Button>
        )}
      </div>

      <Tabs defaultValue="assigned" className="space-y-4">
        <TabsList>
          <TabsTrigger value="assigned">Назначенные мне</TabsTrigger>
          <TabsTrigger value="my">Мои документы</TabsTrigger>
        </TabsList>
        <TabsContent value="assigned" className="space-y-4">
          {assignedDocuments.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {assignedDocuments.map((assignment) => (
                <Card key={assignment.id}>
                  <CardHeader>
                    <CardTitle className="truncate">{assignment.document.title}</CardTitle>
                    <CardDescription>
                      Статус:{" "}
                      {assignment.status === "PENDING"
                        ? "Ожидает ознакомления"
                        : assignment.status === "VIEWED"
                          ? "Просмотрен"
                          : assignment.status === "SIGNED"
                            ? "Подписан"
                            : "Отклонен"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Добавлен: {formatDate(assignment.createdAt)}</p>
                    {assignment.document.expirationDate && (
                      <p className="text-sm text-muted-foreground">
                        Истекает: {formatDate(assignment.document.expirationDate)}
                      </p>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button asChild variant="outline" className="w-full">
                      <Link href={`/documents/${assignment.document.id}`}>Просмотреть</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">У вас нет назначенных документов</p>
          )}
        </TabsContent>
        <TabsContent value="my" className="space-y-4">
          {myDocuments.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {myDocuments.map((document) => (
                <Card key={document.id}>
                  <CardHeader>
                    <CardTitle className="truncate">{document.title}</CardTitle>
                    <CardDescription>
                      Статус:{" "}
                      {document.status === "DRAFT"
                        ? "Черновик"
                        : document.status === "PUBLISHED"
                          ? "Опубликован"
                          : document.status === "ARCHIVED"
                            ? "Архивирован"
                            : "Истек"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Создан: {formatDate(document.createdAt)}</p>
                    {document.expirationDate && (
                      <p className="text-sm text-muted-foreground">Истекает: {formatDate(document.expirationDate)}</p>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button asChild variant="outline" className="w-full">
                      <Link href={`/documents/${document.id}`}>Просмотреть</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">У вас нет созданных документов</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
