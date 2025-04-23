import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate } from "@/lib/utils"
import Link from "next/link"
import { Search } from "@/components/search"
import { FileText, User, Calendar, GraduationCap } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const query = searchParams.q || ""

  // Search documents
  const documents = await db.document.findMany({
    where: {
      OR: [{ title: { contains: query, mode: "insensitive" } }, { content: { contains: query, mode: "insensitive" } }],
    },
    include: {
      documentType: true,
      uploader: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    take: 10,
  })

  // Search users
  const users = await db.user.findMany({
    where: {
      OR: [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { middleName: { contains: query, mode: "insensitive" } },
        { position: { contains: query, mode: "insensitive" } },
        { department: { contains: query, mode: "insensitive" } },
      ],
    },
    include: {
      roles: true,
    },
    take: 10,
  })

  // Search vacations
  const vacations = await db.vacation.findMany({
    where: {
      OR: [{ description: { contains: query, mode: "insensitive" } }],
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    take: 10,
  })

  // Search trainings
  const trainings = await db.training.findMany({
    where: {
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ],
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    take: 10,
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold">Поиск</h1>
          {query && (
            <p className="text-muted-foreground">
              Результаты поиска для: <span className="font-medium">{query}</span>
            </p>
          )}
        </div>
        <Search placeholder="Поиск по системе..." defaultValue={query} />
      </div>

      {!query ? (
        <div className="flex h-[400px] items-center justify-center rounded-md border border-dashed">
          <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Введите поисковый запрос</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Вы можете искать документы, сотрудников, отпуска и обучения.
            </p>
          </div>
        </div>
      ) : (
        <Tabs defaultValue="documents" className="space-y-4">
          <TabsList>
            <TabsTrigger value="documents">Документы ({documents.length})</TabsTrigger>
            <TabsTrigger value="users">Сотрудники ({users.length})</TabsTrigger>
            <TabsTrigger value="vacations">Отпуска ({vacations.length})</TabsTrigger>
            <TabsTrigger value="trainings">Обучения ({trainings.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="documents" className="space-y-4">
            {documents.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {documents.map((document) => (
                  <Card key={document.id}>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                      <div className="space-y-1">
                        <CardTitle className="line-clamp-1">{document.title}</CardTitle>
                        <CardDescription>Тип: {document.documentType.name}</CardDescription>
                      </div>
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      {document.content && (
                        <p className="line-clamp-2 text-sm text-muted-foreground mb-2">{document.content}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {document.uploader.lastName} {document.uploader.firstName}
                        </p>
                        <Link href={`/documents/${document.id}`} className="text-xs text-primary hover:underline">
                          Просмотреть
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">Документы не найдены</p>
            )}
          </TabsContent>
          <TabsContent value="users" className="space-y-4">
            {users.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {users.map((user) => (
                  <Card key={user.id}>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                      <div className="space-y-1">
                        <CardTitle>
                          {user.lastName} {user.firstName} {user.middleName}
                        </CardTitle>
                        <CardDescription>{user.position}</CardDescription>
                      </div>
                      <User className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">Отдел: {user.department}</p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {user.roles.map((role) => (
                          <Badge key={role.id} variant="outline">
                            {role.name}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex justify-end">
                        <Link href={`/profile/${user.id}`} className="text-xs text-primary hover:underline">
                          Профиль
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">Сотрудники не найдены</p>
            )}
          </TabsContent>
          <TabsContent value="vacations" className="space-y-4">
            {vacations.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {vacations.map((vacation) => (
                  <Card key={vacation.id}>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                      <div className="space-y-1">
                        <CardTitle>
                          {vacation.user.lastName} {vacation.user.firstName}
                        </CardTitle>
                        <CardDescription>
                          {formatDate(vacation.startDate)} - {formatDate(vacation.endDate)}
                        </CardDescription>
                      </div>
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      {vacation.description && (
                        <p className="text-sm text-muted-foreground mb-2">{vacation.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <Badge
                          variant={
                            vacation.status === "PENDING"
                              ? "outline"
                              : vacation.status === "APPROVED"
                                ? "default"
                                : "destructive"
                          }
                        >
                          {vacation.status === "PENDING"
                            ? "На рассмотрении"
                            : vacation.status === "APPROVED"
                              ? "Одобрен"
                              : "Отклонен"}
                        </Badge>
                        <Link href="/vacations" className="text-xs text-primary hover:underline">
                          Подробнее
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">Отпуска не найдены</p>
            )}
          </TabsContent>
          <TabsContent value="trainings" className="space-y-4">
            {trainings.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {trainings.map((training) => (
                  <Card key={training.id}>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                      <div className="space-y-1">
                        <CardTitle>{training.title}</CardTitle>
                        <CardDescription>
                          {formatDate(training.startDate)} - {formatDate(training.endDate)}
                        </CardDescription>
                      </div>
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      {training.description && (
                        <p className="text-sm text-muted-foreground mb-2">{training.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {training.user.lastName} {training.user.firstName}
                        </p>
                        <Badge variant={training.completed ? "default" : "outline"}>
                          {training.completed ? "Завершено" : "В процессе"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">Обучения не найдены</p>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
