"use client"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/utils"
import { markNotificationAsRead, deleteNotification } from "@/app/actions/notifications"
import { Check, Trash } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface NotificationItemProps {
  notification: {
    id: string
    title: string
    content: string
    type: string
    read: boolean
    createdAt: Date
  }
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const { toast } = useToast()

  const handleMarkAsRead = async () => {
    const formData = new FormData()
    formData.append("notificationId", notification.id)
    await markNotificationAsRead(formData)

    toast({
      title: "Уведомление отмечено как прочитанное",
    })
  }

  const handleDelete = async () => {
    const formData = new FormData()
    formData.append("notificationId", notification.id)
    await deleteNotification(formData)

    toast({
      title: "Уведомление удалено",
    })
  }

  return (
    <Card className={notification.read ? "bg-muted/40" : ""}>
      <CardHeader>
        <CardTitle className="text-lg">{notification.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{notification.content}</p>
        <p className="text-sm text-muted-foreground mt-2">{formatDate(notification.createdAt)}</p>
      </CardContent>
      <CardFooter className="flex justify-end space-x-2">
        {!notification.read && (
          <Button variant="outline" size="sm" onClick={handleMarkAsRead}>
            <Check className="mr-2 h-4 w-4" />
            Отметить как прочитанное
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={handleDelete}>
          <Trash className="mr-2 h-4 w-4" />
          Удалить
        </Button>
      </CardFooter>
    </Card>
  )
}
