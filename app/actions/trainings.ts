"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createTraining(formData: FormData) {
  const title = formData.get("title") as string
  const description = formData.get("description") as string
  const startDate = formData.get("startDate") as string
  const endDate = formData.get("endDate") as string
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

  // Create trainings for all target users
  if (targetUserIds.length > 0) {
    await db.training.createMany({
      data: targetUserIds.map((userId) => ({
        userId,
        title,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        completed: false,
      })),
    })

    // Create notifications for all target users
    await db.notification.createMany({
      data: targetUserIds.map((userId) => ({
        title: "Новое обучение",
        content: `Вам назначено новое обучение: ${title}`,
        type: "TRAINING",
        userId,
      })),
    })
  }

  revalidatePath("/admin/trainings")
  redirect("/admin/trainings")
}

export async function completeTraining(formData: FormData) {
  const trainingId = formData.get("trainingId") as string

  await db.training.update({
    where: {
      id: trainingId,
    },
    data: {
      completed: true,
    },
  })

  revalidatePath("/trainings")
}

export async function deleteTraining(formData: FormData) {
  const trainingId = formData.get("trainingId") as string

  await db.training.delete({
    where: {
      id: trainingId,
    },
  })

  revalidatePath("/admin/trainings")
  revalidatePath("/trainings")
}
