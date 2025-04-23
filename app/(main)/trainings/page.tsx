import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { TrainingActions } from "@/components/training-actions"

export default async function TrainingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const userId = session.user.id

  // Get user's trainings
  const trainings = await db.training.findMany({
    where: {
      userId,
    },
    orderBy: {
      startDate: "desc",
    },
  })

  // Group trainings by status
  const upcomingTrainings = trainings.filter((t) => new Date(t.startDate) > new Date() && !t.completed)
  const ongoingTrainings = trainings.filter(
    (t) => new Date(t.startDate) <= new Date() && new Date(t.endDate) >= new Date() && !t.completed,
  )
  const completedTrainings = trainings.filter((t) => t.completed)
  const pastTrainings = trainings.filter((t) => new Date(t.endDate) < new Date() && !t.completed)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Обучения</h1>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">Все</TabsTrigger>
          <TabsTrigger value="upcoming">Предстоящие</TabsTrigger>
          <TabsTrigger value="ongoing">Текущие</TabsTrigger>
          <TabsTrigger value="completed">Завершенные</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="space-y-4">
          {trainings.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {trainings.map((training) => (
                <Card key={training.id}>
                  <CardHeader>
                    <CardTitle className="truncate">{training.title}</CardTitle>
                    <CardDescription>
                      {formatDate(training.startDate)} - {formatDate(training.endDate)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {training.description && (
                      <p className="text-sm text-muted-foreground mb-4">{training.description}</p>
                    )}
                    <Badge
                      variant={
                        new Date(training.startDate) > new Date()
                          ? "outline"
                          : new Date(training.endDate) < new Date() && !training.completed
                            ? "destructive"
                            : training.completed
                              ? "default"
                              : "secondary"
                      }
                    >
                      {new Date(training.startDate) > new Date()
                        ? "Предстоящее"
                        : new Date(training.endDate) < new Date() && !training.completed
                          ? "Просрочено"
                          : training.completed
                            ? "Завершено"
                            : "В процессе"}
                    </Badge>
                  </CardContent>
                  <CardFooter>
                    <TrainingActions training={training} />
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">У вас нет назначенных обучений</p>
          )}
        </TabsContent>
        <TabsContent value="upcoming" className="space-y-4">
          {upcomingTrainings.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcomingTrainings.map((training) => (
                <Card key={training.id}>
                  <CardHeader>
                    <CardTitle className="truncate">{training.title}</CardTitle>
                    <CardDescription>
                      {formatDate(training.startDate)} - {formatDate(training.endDate)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {training.description && (
                      <p className="text-sm text-muted-foreground mb-4">{training.description}</p>
                    )}
                    <Badge variant="outline">Предстоящее</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">У вас нет предстоящих обучений</p>
          )}
        </TabsContent>
        <TabsContent value="ongoing" className="space-y-4">
          {ongoingTrainings.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {ongoingTrainings.map((training) => (
                <Card key={training.id}>
                  <CardHeader>
                    <CardTitle className="truncate">{training.title}</CardTitle>
                    <CardDescription>
                      {formatDate(training.startDate)} - {formatDate(training.endDate)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {training.description && (
                      <p className="text-sm text-muted-foreground mb-4">{training.description}</p>
                    )}
                    <Badge variant="secondary">В процессе</Badge>
                  </CardContent>
                  <CardFooter>
                    <TrainingActions training={training} />
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">У вас нет текущих обучений</p>
          )}
        </TabsContent>
        <TabsContent value="completed" className="space-y-4">
          {completedTrainings.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {completedTrainings.map((training) => (
                <Card key={training.id}>
                  <CardHeader>
                    <CardTitle className="truncate">{training.title}</CardTitle>
                    <CardDescription>
                      {formatDate(training.startDate)} - {formatDate(training.endDate)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {training.description && (
                      <p className="text-sm text-muted-foreground mb-4">{training.description}</p>
                    )}
                    <Badge>Завершено</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">У вас нет завершенных обучений</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
