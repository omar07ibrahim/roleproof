"use server"

import { db } from "@/lib/db"
import { hash } from "bcryptjs"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createUser(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const firstName = formData.get("firstName") as string
  const lastName = formData.get("lastName") as string
  const middleName = formData.get("middleName") as string
  const position = formData.get("position") as string
  const department = formData.get("department") as string
  const phoneNumber = formData.get("phoneNumber") as string
  const roleIds = formData.getAll("roles") as string[]

  // Check if user already exists
  const existingUser = await db.user.findUnique({
    where: {
      email,
    },
  })

  if (existingUser) {
    return { error: "Пользователь с таким email уже существует" }
  }

  // Hash password
  const hashedPassword = await hash(password, 10)

  // Create user
  const user = await db.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      middleName,
      position,
      department,
      phoneNumber,
      roles: {
        connect: roleIds.map((id) => ({ id })),
      },
    },
  })

  revalidatePath("/admin/users")
  redirect("/admin/users")
}

export async function updateUser(formData: FormData) {
  const userId = formData.get("userId") as string
  const email = formData.get("email") as string
  const firstName = formData.get("firstName") as string
  const lastName = formData.get("lastName") as string
  const middleName = formData.get("middleName") as string
  const position = formData.get("position") as string
  const department = formData.get("department") as string
  const phoneNumber = formData.get("phoneNumber") as string
  const roleIds = formData.getAll("roles") as string[]

  // Update user
  await db.user.update({
    where: {
      id: userId,
    },
    data: {
      email,
      firstName,
      lastName,
      middleName,
      position,
      department,
      phoneNumber,
      roles: {
        set: [],
        connect: roleIds.map((id) => ({ id })),
      },
    },
  })

  revalidatePath("/admin/users")
  redirect("/admin/users")
}

export async function deleteUser(formData: FormData) {
  const userId = formData.get("userId") as string

  await db.user.delete({
    where: {
      id: userId,
    },
  })

  revalidatePath("/admin/users")
}

export async function uploadProfilePhoto(formData: FormData) {
  const userId = formData.get("userId") as string
  const photoFile = formData.get("photo") as File

  if (!photoFile) {
    return { error: "Файл не выбран" }
  }

  // In a real application, you would upload the file to a storage service
  // and get a URL back. For this example, we'll just pretend we did that.
  const photoUrl = `/placeholder.svg?height=200&width=200`

  await db.user.update({
    where: {
      id: userId,
    },
    data: {
      photoUrl,
    },
  })

  revalidatePath(`/profile/${userId}`)
  return { success: "Фото профиля обновлено" }
}
