import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { DocumentActions } from "@/components/document-actions"
import Link from "next/link"
import { ArrowLeft, Download, Edit, FileText } from "lucide-react"

export default async function DocumentPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const document = await db.document.findUnique({
    where: {
      id: params.id,
    },
    include: {
      documentType: true,
      uploader: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
        },
      },
      assignments: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true,
              department: true,
            },
          },
        },
      },
    },
  })

  if (!document) {
    notFound()
  }

  // Get current user's assignment if exists
  const userAssignment = document.assignments.find((assignment) => assignment.userId === session.user.id)

  // Check if user can edit document
  const canEditDocument =
    document.uploaderId === session.user.id ||
    session.user.permissions.includes("edit:documents") ||
    session.user.roles.includes("admin")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/documents">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Назад</span>
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">{document.title}</h1>
          <Badge
            variant={
              document.status === "DRAFT"
                ? "outline"
                : document.status === "PUBLISHED"
                  ? "default"
                  : document.status === "ARCHIVED"
                    ? "secondary"
                    : "destructive"
            }
          >
            {document.status === "DRAFT"
              ? "Черновик"
              : document.status === "PUBLISHED"
                ? "Опубликован"
                : document.status === "ARCHIVED"
                  ? "Архивирован"
                  : "Истек"}
          </Badge>
        </div>
        <div className="flex items-center space-x-2">
          {document.fileUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={document.fileUrl} download>
                <Download className="mr-2 h-4 w-4" />
                Скачать
              </a>
            </Button>
          )}
          {canEditDocument && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/documents/${document.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Редактировать
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Содержание документа</CardTitle>
              <CardDescription>Тип: {document.documentType.name}</CardDescription>
            </CardHeader>
            <CardContent>
              {document.content ? (
                <div className="prose max-w-none">
                  <p>{document.content}</p>
                </div>
              ) : (
                <div className="flex items-center justify-center p-12 border-2 border-dashed rounded-md">
                  <div className="text-center">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">Документ без текстового содержания</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {Object.keys(document.metadata).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Дополнительная информация</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  {Object.entries(document.metadata).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <dt className="text-sm font-medium text-muted-foreground">{key}</dt>
                      <dd className="text-sm">{value as string}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}

          {userAssignment && (
            <Card>
              <CardHeader>
                <CardTitle>Действия</CardTitle>
                <CardDescription>
                  Статус:{" "}
                  {userAssignment.status === "PENDING"
                    ? "Ожидает ознакомления"
                    : userAssignment.status === "VIEWED"
                      ? "Просмотрен"
                      : userAssignment.status === "SIGNED"
                        ? "Подписан"
                        : "Отклонен"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DocumentActions assignment={userAssignment} />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Информация о документе</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                <div className="space-y-1">
                  <dt className="text-sm font-medium text-muted-foreground">Создан</dt>
                  <dd className="text-sm">{formatDate(document.createdAt)}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-sm font-medium text-muted-foreground">Обновлен</dt>
                  <dd className="text-sm">{formatDate(document.updatedAt)}</dd>
                </div>
                {document.expirationDate && (
                  <div className="space-y-1">
                    <dt className="text-sm font-medium text-muted-foreground">Срок действия</dt>
                    <dd className="text-sm">{formatDate(document.expirationDate)}</dd>
                  </div>
                )}
                <div className="space-y-1">
                  <dt className="text-sm font-medium text-muted-foreground">Автор</dt>
                  <dd className="text-sm">
                    {document.uploader.lastName} {document.uploader.firstName} {document.uploader.middleName}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Назначено</CardTitle>
              <CardDescription>{document.assignments.length} сотрудников</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="all" className="space-y-4">
                <TabsList className="grid grid-cols-4">
                  <TabsTrigger value="all">Все</TabsTrigger>
                  <TabsTrigger value="pending">Ожидают</TabsTrigger>
                  <TabsTrigger value="viewed">Просмотрели</TabsTrigger>
                  <TabsTrigger value="signed">Подписали</TabsTrigger>
                </TabsList>
                <TabsContent value="all" className="space-y-4">
                  {document.assignments.length > 0 ? (
                    <div className="space-y-4">
                      {document.assignments.map((assignment) => (
                        <div key={assignment.id} className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {assignment.user.lastName} {assignment.user.firstName} {assignment.user.middleName}
                            </p>
                            <p className="text-sm text-muted-foreground">{assignment.user.department}</p>
                          </div>
                          <Badge
                            variant={
                              assignment.status === "PENDING"
                                ? "outline"
                                : assignment.status === "VIEWED"
                                  ? "secondary"
                                  : assignment.status === "SIGNED"
                                    ? "default"
                                    : "destructive"
                            }
                          >
                            {assignment.status === "PENDING"
                              ? "Ожидает"
                              : assignment.status === "VIEWED"
                                ? "Просмотрел"
                                : assignment.status === "SIGNED"
                                  ? "Подписал"
                                  : "Отклонил"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Документ никому не назначен</p>
                  )}
                </TabsContent>
                <TabsContent value="pending" className="space-y-4">
                  {document.assignments.filter((a) => a.status === "PENDING").length > 0 ? (
                    <div className="space-y-4">
                      {document.assignments
                        .filter((a) => a.status === "PENDING")
                        .map((assignment) => (
                          <div key={assignment.id} className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">
                                {assignment.user.lastName} {assignment.user.firstName} {assignment.user.middleName}
                              </p>
                              <p className="text-sm text-muted-foreground">{assignment.user.department}</p>
                            </div>
                            <Badge variant="outline">Ожидает</Badge>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Нет ожидающих сотрудников</p>
                  )}
                </TabsContent>
                <TabsContent value="viewed" className="space-y-4">
                  {document.assignments.filter((a) => a.status === "VIEWED").length > 0 ? (
                    <div className="space-y-4">
                      {document.assignments
                        .filter((a) => a.status === "VIEWED")
                        .map((assignment) => (
                          <div key={assignment.id} className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">
                                {assignment.user.lastName} {assignment.user.firstName} {assignment.user.middleName}
                              </p>
                              <p className="text-sm text-muted-foreground">{assignment.user.department}</p>
                            </div>
                            <Badge variant="secondary">Просмотрел</Badge>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Нет просмотревших сотрудников</p>
                  )}
                </TabsContent>
                <TabsContent value="signed" className="space-y-4">
                  {document.assignments.filter((a) => a.status === "SIGNED").length > 0 ? (
                    <div className="space-y-4">
                      {document.assignments
                        .filter((a) => a.status === "SIGNED")
                        .map((assignment) => (
                          <div key={assignment.id} className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">
                                {assignment.user.lastName} {assignment.user.firstName} {assignment.user.middleName}
                              </p>
                              <p className="text-sm text-muted-foreground">{assignment.user.department}</p>
                            </div>
                            <Badge>Подписал</Badge>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Нет подписавших сотрудников</p>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
