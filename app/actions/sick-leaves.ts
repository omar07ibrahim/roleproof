"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function reportSickLeave(formData: FormData) {
  const userId = formData.get("userId") as string
  const startDate = formData.get("startDate") as string
  const endDate = (formData.get("endDate") as string) || null

  await db.sickLeave.create({
    data: {
      userId,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
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
        title: "Новый больничный",
        content: `${user?.firstName} ${user?.lastName} сообщил о больничном с ${new Date(startDate).toLocaleDateString()}${endDate ? ` по ${new Date(endDate).toLocaleDateString()}` : ""}`,
        type: "OTHER",
        userId: manager.id,
      })),
    })
  }

  revalidatePath("/sick-leaves")
  redirect("/sick-leaves")
}

export async function updateSickLeave(formData: FormData) {
  const sickLeaveId = formData.get("sickLeaveId") as string
  const endDate = formData.get("endDate") as string

  await db.sickLeave.update({
    where: {
      id: sickLeaveId,
    },
    data: {
      endDate: new Date(endDate),
    },
  })

  revalidatePath("/sick-leaves")
  redirect("/sick-leaves")
}

export async function deleteSickLeave(formData: FormData) {
  const sickLeaveId = formData.get("sickLeaveId") as string

  await db.sickLeave.delete({
    where: {
      id: sickLeaveId,
    },
  })

  revalidatePath("/sick-leaves")
  redirect("/sick-leaves")
}
