"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createRole(formData: FormData) {
  const name = formData.get("name") as string
  const description = formData.get("description") as string
  const permissionIds = formData.getAll("permissions") as string[]

  // Check if role already exists
  const existingRole = await db.role.findUnique({
    where: {
      name,
    },
  })

  if (existingRole) {
    return { error: "Роль с таким именем уже существует" }
  }

  // Create role
  await db.role.create({
    data: {
      name,
      description,
      permissions: {
        connect: permissionIds.map((id) => ({ id })),
      },
    },
  })

  revalidatePath("/admin/roles")
  redirect("/admin/roles")
}

export async function updateRole(formData: FormData) {
  const roleId = formData.get("roleId") as string
  const name = formData.get("name") as string
  const description = formData.get("description") as string
  const permissionIds = formData.getAll("permissions") as string[]

  // Update role
  await db.role.update({
    where: {
      id: roleId,
    },
    data: {
      name,
      description,
      permissions: {
        set: [],
        connect: permissionIds.map((id) => ({ id })),
      },
    },
  })

  revalidatePath("/admin/roles")
  redirect("/admin/roles")
}

export async function deleteRole(formData: FormData) {
  const roleId = formData.get("roleId") as string

  await db.role.delete({
    where: {
      id: roleId,
    },
  })

  revalidatePath("/admin/roles")
}
