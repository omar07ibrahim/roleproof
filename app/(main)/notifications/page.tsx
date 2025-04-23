import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { NotificationItem } from "@/components/notification-item"
import { markAllNotificationsAsRead } from "@/app/actions/notifications"
import { Check } from "lucide-react"

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const userId = session.user.id

  // Get user's notifications
  const notifications = await db.notification.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  // Group notifications by read status
  const unreadNotifications = notifications.filter((n) => !n.read)
  const readNotifications = notifications.filter((n) => n.read)

  const handleMarkAllAsRead = async () => {
    "use server"

    const formData = new FormData()
    formData.append("userId", userId)
    await markAllNotificationsAsRead(formData)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Уведомления</h1>
        {unreadNotifications.length > 0 && (
          <form action={handleMarkAllAsRead}>
            <Button type="submit" variant="outline" size="sm">
              <Check className="mr-2 h-4 w-4" />
              Отметить все как прочитанные
            </Button>
          </form>
        )}
      </div>

      <Tabs defaultValue="unread" className="space-y-4">
        <TabsList>
          <TabsTrigger value="unread">Непрочитанные ({unreadNotifications.length})</TabsTrigger>
          <TabsTrigger value="all">Все ({notifications.length})</TabsTrigger>
          <TabsTrigger value="read">Прочитанные ({readNotifications.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="unread" className="space-y-4">
          {unreadNotifications.length > 0 ? (
            <div className="space-y-4">
              {unreadNotifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">У вас нет непрочитанных уведомлений</p>
          )}
        </TabsContent>
        <TabsContent value="all" className="space-y-4">
          {notifications.length > 0 ? (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">У вас нет уведомлений</p>
          )}
        </TabsContent>
        <TabsContent value="read" className="space-y-4">
          {readNotifications.length > 0 ? (
            <div className="space-y-4">
              {readNotifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">У вас нет прочитанных уведомлений</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
