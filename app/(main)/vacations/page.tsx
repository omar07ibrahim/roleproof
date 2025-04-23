import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate } from "@/lib/utils"
import { VacationRequestForm } from "@/components/vacation-request-form"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "lucide-react"

export default async function VacationsPage() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const userId = session.user.id

  // Get user's vacations
  const vacations = await db.vacation.findMany({
    where: {
      userId,
    },
    orderBy: {
      startDate: "desc",
    },
  })

  // Group vacations by status
  const pendingVacations = vacations.filter((v) => v.status === "PENDING")
  const approvedVacations = vacations.filter((v) => v.status === "APPROVED")
  const rejectedVacations = vacations.filter((v) => v.status === "REJECTED")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Отпуска</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Запросить отпуск</CardTitle>
            <CardDescription>Заполните форму для запроса отпуска</CardDescription>
          </CardHeader>
          <CardContent>
            <VacationRequestForm userId={userId} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Мои отпуска</CardTitle>
            <CardDescription>Всего отпусков: {vacations.length}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="space-y-4">
              <TabsList>
                <TabsTrigger value="all">Все</TabsTrigger>
                <TabsTrigger value="pending">На рассмотрении</TabsTrigger>
                <TabsTrigger value="approved">Одобренные</TabsTrigger>
                <TabsTrigger value="rejected">Отклоненные</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="space-y-4">
                {vacations.length > 0 ? (
                  <div className="space-y-4">
                    {vacations.map((vacation) => (
                      <div key={vacation.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <Calendar className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">
                              {formatDate(vacation.startDate)} - {formatDate(vacation.endDate)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {Math.ceil(
                                (new Date(vacation.endDate).getTime() - new Date(vacation.startDate).getTime()) /
                                  (1000 * 60 * 60 * 24),
                              )}{" "}
                              дней
                            </p>
                          </div>
                        </div>
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
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">У вас нет запросов на отпуск</p>
                )}
              </TabsContent>
              <TabsContent value="pending" className="space-y-4">
                {pendingVacations.length > 0 ? (
                  <div className="space-y-4">
                    {pendingVacations.map((vacation) => (
                      <div key={vacation.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <Calendar className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">
                              {formatDate(vacation.startDate)} - {formatDate(vacation.endDate)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {Math.ceil(
                                (new Date(vacation.endDate).getTime() - new Date(vacation.startDate).getTime()) /
                                  (1000 * 60 * 60 * 24),
                              )}{" "}
                              дней
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">На рассмотрении</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">У вас нет запросов на рассмотрении</p>
                )}
              </TabsContent>
              <TabsContent value="approved" className="space-y-4">
                {approvedVacations.length > 0 ? (
                  <div className="space-y-4">
                    {approvedVacations.map((vacation) => (
                      <div key={vacation.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <Calendar className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">
                              {formatDate(vacation.startDate)} - {formatDate(vacation.endDate)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {Math.ceil(
                                (new Date(vacation.endDate).getTime() - new Date(vacation.startDate).getTime()) /
                                  (1000 * 60 * 60 * 24),
                              )}{" "}
                              дней
                            </p>
                          </div>
                        </div>
                        <Badge>Одобрен</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">У вас нет одобренных отпусков</p>
                )}
              </TabsContent>
              <TabsContent value="rejected" className="space-y-4">
                {rejectedVacations.length > 0 ? (
                  <div className="space-y-4">
                    {rejectedVacations.map((vacation) => (
                      <div key={vacation.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <Calendar className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">
                              {formatDate(vacation.startDate)} - {formatDate(vacation.endDate)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {Math.ceil(
                                (new Date(vacation.endDate).getTime() - new Date(vacation.startDate).getTime()) /
                                  (1000 * 60 * 60 * 24),
                              )}{" "}
                              дней
                            </p>
                          </div>
                        </div>
                        <Badge variant="destructive">Отклонен</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">У вас нет отклоненных отпусков</p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
