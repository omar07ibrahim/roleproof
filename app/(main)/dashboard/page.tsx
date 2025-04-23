import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { formatDate } from "@/lib/utils"
import Link from "next/link"
import { AlertCircle, Calendar, FileText, GraduationCap } from "lucide-react"
import { DashboardStats } from "@/components/dashboard-stats"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const userId = session.user.id
  const isAdmin = session.user.roles.includes("admin")
  const isManager = session.user.roles.includes("manager")

  // Get pending documents
  const pendingDocuments = await db.documentAssignment.findMany({
    where: {
      userId,
      status: "PENDING",
    },
    include: {
      document: true,
    },
    take: 5,
  })

  // Get upcoming vacations
  const upcomingVacations = await db.vacation.findMany({
    where: {
      userId,
      startDate: {
        gte: new Date(),
      },
    },
    orderBy: {
      startDate: "asc",
    },
    take: 3,
  })

  // Get upcoming trainings
  const upcomingTrainings = await db.training.findMany({
    where: {
      userId,
      startDate: {
        gte: new Date(),
      },
      completed: false,
    },
    orderBy: {
      startDate: "asc",
    },
    take: 3,
  })

  // Get expiring documents
  const expiringDocuments = await db.document.findMany({
    where: {
      uploaderId: userId,
      expirationDate: {
        gte: new Date(),
        lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
    },
    orderBy: {
      expirationDate: "asc",
    },
    take: 5,
  })

  // Get statistics for admin/manager dashboard
  let documentStats = null
  let userStats = null
  let vacationStats = null

  if (isAdmin || isManager) {
    // Document statistics
    const totalDocuments = await db.document.count()

    const documentsByStatus = await db.$queryRaw<{ status: string; count: number }[]>`
      SELECT "status", COUNT(*) as count
      FROM "Document"
      GROUP BY "status"
    `

    const documentsByMonth = await db.$queryRaw<{ month: string; count: number }[]>`
      SELECT TO_CHAR("createdAt", 'YYYY-MM') as month, COUNT(*) as count
      FROM "Document"
      WHERE "createdAt" > NOW() - INTERVAL '6 months'
      GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
      ORDER BY month
    `

    // User statistics
    const totalUsers = await db.user.count()

    const usersByDepartment = await db.$queryRaw<{ department: string; count: number }[]>`
      SELECT "department", COUNT(*) as count
      FROM "User"
      GROUP BY "department"
      ORDER BY count DESC
    `

    // Vacation statistics
    const pendingVacations = await db.vacation.count({
      where: { status: "PENDING" },
    })

    const approvedVacations = await db.vacation.count({
      where: { status: "APPROVED" },
    })

    const rejectedVacations = await db.vacation.count({
      where: { status: "REJECTED" },
    })

    const vacationsByMonth = await db.$queryRaw<{ month: string; count: number }[]>`
      SELECT TO_CHAR("startDate", 'YYYY-MM') as month, COUNT(*) as count
      FROM "Vacation"
      WHERE "startDate" > NOW() - INTERVAL '6 months'
      GROUP BY TO_CHAR("startDate", 'YYYY-MM')
      ORDER BY month
    `

    documentStats = {
      totalDocuments,
      documentsByStatus,
      documentsByMonth,
    }

    userStats = {
      totalUsers,
      usersByDepartment,
    }

    vacationStats = {
      pendingVacations,
      approvedVacations,
      rejectedVacations,
      vacationsByMonth,
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Панель управления</h1>
      </div>

      {(isAdmin || isManager) && documentStats && userStats && vacationStats && (
        <DashboardStats documentStats={documentStats} userStats={userStats} vacationStats={vacationStats} />
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Документы на подпись</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingDocuments.length}</div>
            <p className="text-xs text-muted-foreground">Документов ожидают вашего ознакомления</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ближайший отпуск</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {upcomingVacations.length > 0 ? (
              <>
                <div className="text-2xl font-bold">{formatDate(upcomingVacations[0].startDate)}</div>
                <p className="text-xs text-muted-foreground">До {formatDate(upcomingVacations[0].endDate)}</p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">-</div>
                <p className="text-xs text-muted-foreground">Нет запланированных отпусков</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ближайшее обучение</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {upcomingTrainings.length > 0 ? (
              <>
                <div className="text-2xl font-bold">{upcomingTrainings[0].title}</div>
                <p className="text-xs text-muted-foreground">{formatDate(upcomingTrainings[0].startDate)}</p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">-</div>
                <p className="text-xs text-muted-foreground">Нет запланированных обучений</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Истекающие документы</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiringDocuments.length}</div>
            <p className="text-xs text-muted-foreground">Документов истекают в ближайшие 30 дней</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Документы на подпись</CardTitle>
            <CardDescription>Документы, требующие вашего ознакомления или подписи</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingDocuments.length > 0 ? (
              <div className="space-y-4">
                {pendingDocuments.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between">
                    <div>
                      <Link href={`/documents/${assignment.document.id}`} className="font-medium hover:underline">
                        {assignment.document.title}
                      </Link>
                      <p className="text-sm text-muted-foreground">Добавлен: {formatDate(assignment.createdAt)}</p>
                    </div>
                    <Link
                      href={`/documents/${assignment.document.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      Просмотреть
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">Нет документов, требующих вашего внимания</p>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Истекающие документы</CardTitle>
            <CardDescription>Ваши документы, срок действия которых истекает в ближайшие 30 дней</CardDescription>
          </CardHeader>
          <CardContent>
            {expiringDocuments.length > 0 ? (
              <div className="space-y-4">
                {expiringDocuments.map((document) => (
                  <div key={document.id} className="flex items-center justify-between">
                    <div>
                      <Link href={`/documents/${document.id}`} className="font-medium hover:underline">
                        {document.title}
                      </Link>
                      <p className="text-sm text-muted-foreground">Истекает: {formatDate(document.expirationDate!)}</p>
                    </div>
                    <Link href={`/documents/${document.id}`} className="text-sm text-primary hover:underline">
                      Просмотреть
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">Нет документов, срок действия которых истекает в ближайшее время</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Ближайшие отпуска</CardTitle>
            <CardDescription>Ваши запланированные отпуска</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingVacations.length > 0 ? (
              <div className="space-y-4">
                {upcomingVacations.map((vacation) => (
                  <div key={vacation.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {formatDate(vacation.startDate)} - {formatDate(vacation.endDate)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Статус:{" "}
                        {vacation.status === "PENDING"
                          ? "На рассмотрении"
                          : vacation.status === "APPROVED"
                            ? "Одобрен"
                            : "Отклонен"}
                      </p>
                    </div>
                    <Link href="/vacations" className="text-sm text-primary hover:underline">
                      Подробнее
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">Нет запланированных отпусков</p>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Ближайшие обучения</CardTitle>
            <CardDescription>Ваши запланированные обучения</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingTrainings.length > 0 ? (
              <div className="space-y-4">
                {upcomingTrainings.map((training) => (
                  <div key={training.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{training.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(training.startDate)} - {formatDate(training.endDate)}
                      </p>
                    </div>
                    <Link href="/trainings" className="text-sm text-primary hover:underline">
                      Подробнее
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">Нет запланированных обучений</p>
            )}
          </CardContent>
        </Card>
      </div>

      {expiringDocuments.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>Внимание!</AlertTitle>
          <AlertDescription>
            У вас есть документы, срок действия которых скоро истекает. Пожалуйста, обновите их как можно скорее.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
