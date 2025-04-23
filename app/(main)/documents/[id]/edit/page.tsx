import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { notFound, redirect } from "next/navigation"
import { DocumentForm } from "@/components/document-form"

export default async function EditDocumentPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const document = await db.document.findUnique({
    where: {
      id: params.id,
    },
  })

  if (!document) {
    notFound()
  }

  // Check if user can edit document
  const canEditDocument =
    document.uploaderId === session.user.id ||
    session.user.permissions.includes("edit:documents") ||
    session.user.roles.includes("admin")

  if (!canEditDocument) {
    redirect(`/documents/${params.id}`)
  }

  // Get document types
  const documentTypes = await db.documentType.findMany({
    orderBy: {
      name: "asc",
    },
  })

  // Get users for assignment
  const users = await db.user.findMany({
    orderBy: {
      lastName: "asc",
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      middleName: true,
      department: true,
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Редактировать документ</h1>
        <p className="text-muted-foreground">Обновите информацию о документе</p>
      </div>

      <DocumentForm documentTypes={documentTypes} users={users} currentUserId={session.user.id} document={document} />
    </div>
  )
}
