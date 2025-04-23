"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function requestVacation(formData: FormData) {
  const userId = formData.get("userId") as string
  const startDate = formData.get("startDate") as string
  const endDate = formData.get("endDate") as string

  await db.vacation.create({
    data: {
      userId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: "PENDING",
    },
  })

  // Find managers to notify
  const managers = await db.user.findMany({
    where: {
      roles: {
        some: {
          name: "manager",
        },
      },
    },
    select: {
      id: true,
    },
  })

  // Create notifications for managers
  if (managers.length > 0) {
    const user = await db.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        firstName: true,
        lastName: true,
      },
    })

    await db.notification.createMany({
      data: managers.map((manager) => ({
        title: "Новый запрос на отпуск",
        content: `${user?.firstName} ${user?.lastName} запросил отпуск с ${new Date(startDate).toLocaleDateString()} по ${new Date(endDate).toLocaleDateString()}`,
        type: "VACATION",
        userId: manager.id,
      })),
    })
  }

  revalidatePath("/vacations")
  redirect("/vacations")
}

export async function approveVacation(formData: FormData) {
  const vacationId = formData.get("vacationId") as string

  const vacation = await db.vacation.update({
    where: {
      id: vacationId,
    },
    data: {
      status: "APPROVED",
    },
    include: {
      user: true,
    },
  })

  // Create notification for the user
  await db.notification.create({
    data: {
      title: "Отпуск одобрен",
      content: `Ваш запрос на отпуск с ${vacation.startDate.toLocaleDateString()} по ${vacation.endDate.toLocaleDateString()} был одобрен.`,
      type: "VACATION",
      userId: vacation.userId,
    },
  })

  revalidatePath("/admin/vacations")
  revalidatePath("/vacations")
}

export async function rejectVacation(formData: FormData) {
  const vacationId = formData.get("vacationId") as string
  const reason = formData.get("reason") as string

  const vacation = await db.vacation.update({
    where: {
      id: vacationId,
    },
    data: {
      status: "REJECTED",
    },
    include: {
      user: true,
    },
  })

  // Create notification for the user
  await db.notification.create({
    data: {
      title: "Отпуск отклонен",
      content: `Ваш запрос на отпуск с ${vacation.startDate.toLocaleDateString()} по ${vacation.endDate.toLocaleDateString()} был отклонен. Причина: ${reason}`,
      type: "VACATION",
      userId: vacation.userId,
    },
  })

  revalidatePath("/admin/vacations")
  revalidatePath("/vacations")
}

export async function deleteVacation(formData: FormData) {
  const vacationId = formData.get("vacationId") as string

  await db.vacation.delete({
    where: {
      id: vacationId,
    },
  })

  revalidatePath("/admin/vacations")
  revalidatePath("/vacations")
}
