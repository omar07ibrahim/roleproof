"use server"

import { db } from "@/lib/db"
import { hash, compare } from "bcryptjs"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function register(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const firstName = formData.get("firstName") as string
  const lastName = formData.get("lastName") as string
  const middleName = formData.get("middleName") as string
  const position = formData.get("position") as string
  const department = formData.get("department") as string
  const phoneNumber = formData.get("phoneNumber") as string

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
    },
  })

  // Assign default role
  const defaultRole = await db.role.findFirst({
    where: {
      name: "employee",
    },
  })

  if (defaultRole) {
    await db.user.update({
      where: {
        id: user.id,
      },
      data: {
        roles: {
          connect: {
            id: defaultRole.id,
          },
        },
      },
    })
  }

  revalidatePath("/users")
  redirect("/login")
}

export async function updateProfile(formData: FormData) {
  const userId = formData.get("userId") as string
  const firstName = formData.get("firstName") as string
  const lastName = formData.get("lastName") as string
  const middleName = formData.get("middleName") as string
  const position = formData.get("position") as string
  const department = formData.get("department") as string
  const phoneNumber = formData.get("phoneNumber") as string

  await db.user.update({
    where: {
      id: userId,
    },
    data: {
      firstName,
      lastName,
      middleName,
      position,
      department,
      phoneNumber,
    },
  })

  revalidatePath(`/profile/${userId}`)
  revalidatePath("/users")
  redirect(`/profile/${userId}`)
}

export async function updatePassword(formData: FormData) {
  const userId = formData.get("userId") as string
  const currentPassword = formData.get("currentPassword") as string
  const newPassword = formData.get("newPassword") as string

  const user = await db.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      password: true,
    },
  })

  if (!user) {
    return { error: "Пользователь не найден" }
  }

  const isPasswordValid = await compare(currentPassword, user.password)

  if (!isPasswordValid) {
    return { error: "Неверный текущий пароль" }
  }

  const hashedPassword = await hash(newPassword, 10)

  await db.user.update({
    where: {
      id: userId,
    },
    data: {
      password: hashedPassword,
    },
  })

  return { success: "Пароль успешно обновлен" }
}
