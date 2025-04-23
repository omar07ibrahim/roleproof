import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { DocumentForm } from "@/components/document-form"

export default async function CreateDocumentPage() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  // Check if user can create documents
  const canCreateDocuments =
    session.user.permissions.includes("create:documents") ||
    session.user.roles.includes("admin") ||
    session.user.roles.includes("manager")

  if (!canCreateDocuments) {
    redirect("/documents")
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
        <h1 className="text-3xl font-bold">Создать документ</h1>
        <p className="text-muted-foreground">Создайте новый документ и назначьте его сотрудникам</p>
      </div>

      <DocumentForm documentTypes={documentTypes} users={users} currentUserId={session.user.id} />
    </div>
  )
}
