"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createDocumentType(formData: FormData) {
  const name = formData.get("name") as string
  const description = formData.get("description") as string
  const requiredFields = JSON.parse(formData.get("requiredFields") as string)

  await db.documentType.create({
    data: {
      name,
      description,
      requiredFields,
    },
  })

  revalidatePath("/admin/document-types")
  redirect("/admin/document-types")
}

export async function updateDocumentType(formData: FormData) {
  const typeId = formData.get("typeId") as string
  const name = formData.get("name") as string
  const description = formData.get("description") as string
  const requiredFields = JSON.parse(formData.get("requiredFields") as string)

  await db.documentType.update({
    where: {
      id: typeId,
    },
    data: {
      name,
      description,
      requiredFields,
    },
  })

  revalidatePath("/admin/document-types")
  redirect("/admin/document-types")
}

export async function deleteDocumentType(formData: FormData) {
  const typeId = formData.get("typeId") as string

  await db.documentType.delete({
    where: {
      id: typeId,
    },
  })

  revalidatePath("/admin/document-types")
}

export async function createDocument(formData: FormData) {
  const title = formData.get("title") as string
  const content = formData.get("content") as string
  const documentTypeId = formData.get("documentTypeId") as string
  const uploaderId = formData.get("uploaderId") as string
  const metadata = JSON.parse(formData.get("metadata") as string)
  const status = formData.get("status") as string
  const expirationDate = formData.get("expirationDate") as string
  const assigneeIds = formData.getAll("assignees") as string[]
  const documentFile = formData.get("documentFile") as File

  // In a real application, you would upload the file to a storage service
  // and get a URL back. For this example, we'll just pretend we did that.
  const fileUrl = documentFile ? `/placeholder.svg?height=200&width=200` : null

  const document = await db.document.create({
    data: {
      title,
      content,
      fileUrl,
      documentTypeId,
      uploaderId,
      metadata,
      status: status as any,
      expirationDate: expirationDate ? new Date(expirationDate) : null,
    },
  })

  if (assigneeIds.length > 0) {
    await db.documentAssignment.createMany({
      data: assigneeIds.map((userId) => ({
        documentId: document.id,
        userId,
        status: "PENDING",
      })),
    })

    // Create notifications for assignees
    await db.notification.createMany({
      data: assigneeIds.map((userId) => ({
        title: "Новый документ",
        content: `Вам назначен новый документ: ${title}`,
        type: "DOCUMENT",
        userId,
      })),
    })
  }

  revalidatePath("/documents")
  redirect("/documents")
}

export async function updateDocument(formData: FormData) {
  const documentId = formData.get("documentId") as string
  const title = formData.get("title") as string
  const content = formData.get("content") as string
  const metadata = JSON.parse(formData.get("metadata") as string)
  const status = formData.get("status") as string
  const expirationDate = formData.get("expirationDate") as string
  const documentFile = formData.get("documentFile") as File

  // In a real application, you would upload the file to a storage service
  // and get a URL back. For this example, we'll just pretend we did that.
  const fileUrl = documentFile ? `/placeholder.svg?height=200&width=200` : undefined

  await db.document.update({
    where: {
      id: documentId,
    },
    data: {
      title,
      content,
      fileUrl,
      metadata,
      status: status as any,
      expirationDate: expirationDate ? new Date(expirationDate) : null,
    },
  })

  revalidatePath("/documents")
  redirect(`/documents/${documentId}`)
}

export async function deleteDocument(formData: FormData) {
  const documentId = formData.get("documentId") as string

  await db.document.delete({
    where: {
      id: documentId,
    },
  })

  revalidatePath("/documents")
  redirect("/documents")
}

export async function signDocument(formData: FormData) {
  const assignmentId = formData.get("assignmentId") as string

  await db.documentAssignment.update({
    where: {
      id: assignmentId,
    },
    data: {
      status: "SIGNED",
      signedAt: new Date(),
    },
  })

  const assignment = await db.documentAssignment.findUnique({
    where: {
      id: assignmentId,
    },
    include: {
      document: true,
    },
  })

  if (assignment) {
    revalidatePath(`/documents/${assignment.document.id}`)
    redirect(`/documents/${assignment.document.id}`)
  } else {
    revalidatePath("/documents")
    redirect("/documents")
  }
}

export async function viewDocument(formData: FormData) {
  const assignmentId = formData.get("assignmentId") as string

  await db.documentAssignment.update({
    where: {
      id: assignmentId,
    },
    data: {
      status: "VIEWED",
    },
  })

  const assignment = await db.documentAssignment.findUnique({
    where: {
      id: assignmentId,
    },
    include: {
      document: true,
    },
  })

  if (assignment) {
    revalidatePath(`/documents/${assignment.document.id}`)
  }
}

export async function rejectDocument(formData: FormData) {
  const assignmentId = formData.get("assignmentId") as string
  const reason = formData.get("reason") as string

  await db.documentAssignment.update({
    where: {
      id: assignmentId,
    },
    data: {
      status: "REJECTED",
    },
  })

  const assignment = await db.documentAssignment.findUnique({
    where: {
      id: assignmentId,
    },
    include: {
      document: true,
      user: true,
    },
  })

  if (assignment) {
    // Create notification for document uploader
    await db.notification.create({
      data: {
        title: "Документ отклонен",
        content: `Пользователь ${assignment.user.firstName} ${assignment.user.lastName} отклонил документ "${assignment.document.title}". Причина: ${reason}`,
        type: "DOCUMENT",
        userId: assignment.document.uploaderId,
      },
    })

    revalidatePath(`/documents/${assignment.document.id}`)
    redirect(`/documents/${assignment.document.id}`)
  } else {
    revalidatePath("/documents")
    redirect("/documents")
  }
}
