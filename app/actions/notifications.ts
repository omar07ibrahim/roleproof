"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"

export async function createNotification(formData: FormData) {
  const title = formData.get("title") as string
  const content = formData.get("content") as string
  const type = formData.get("type") as string
  const userIds = formData.getAll("userIds") as string[]
  const departmentFilter = formData.get("departmentFilter") as string
  const roleFilter = formData.get("roleFilter") as string

  let targetUserIds = userIds

  // If department filter is provided, get all users from that department
  if (departmentFilter) {
    const departmentUsers = await db.user.findMany({
      where: {
        department: departmentFilter,
      },
      select: {
        id: true,
      },
    })
    targetUserIds = departmentUsers.map((user) => user.id)
  }

  // If role filter is provided, get all users with that role
  if (roleFilter) {
    const roleUsers = await db.user.findMany({
      where: {
        roles: {
          some: {
            id: roleFilter,
          },
        },
      },
      select: {
        id: true,
      },
    })
    targetUserIds = roleUsers.map((user) => user.id)
  }

  // Create notifications for all target users
  if (targetUserIds.length > 0) {
    await db.notification.createMany({
      data: targetUserIds.map((userId) => ({
        title,
        content,
        type: type as any,
        userId,
      })),
    })
  }

  revalidatePath("/notifications")
  return { success: "Уведомления успешно отправлены" }
}

export async function markNotificationAsRead(formData: FormData) {
  const notificationId = formData.get("notificationId") as string

  await db.notification.update({
    where: {
      id: notificationId,
    },
    data: {
      read: true,
    },
  })

  revalidatePath("/notifications")
}

export async function markAllNotificationsAsRead(formData: FormData) {
  const userId = formData.get("userId") as string

  await db.notification.updateMany({
    where: {
      userId,
      read: false,
    },
    data: {
      read: true,
    },
  })

  revalidatePath("/notifications")
}

export async function deleteNotification(formData: FormData) {
  const notificationId = formData.get("notificationId") as string

  await db.notification.delete({
    where: {
      id: notificationId,
    },
  })

  revalidatePath("/notifications")
}
