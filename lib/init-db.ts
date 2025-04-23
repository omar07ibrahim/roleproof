import { hash } from "bcryptjs"

export async function initializeDatabase() {
  // Проверяем, что мы не в процессе сборки
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE === "phase-production-build") {
    console.log("Skipping database initialization during build")
    return
  }

  try {
    // Динамический импорт для предотвращения проблем во время сборки
    const { db } = await import("./db")

    // Check if we need to initialize the database
    const adminCount = await db.user.count({
      where: {
        roles: {
          some: {
            name: "admin",
          },
        },
      },
    })

    if (adminCount > 0) {
      console.log("Database already initialized")
      return
    }

    console.log("Initializing database...")

    // Create default permissions
    const permissions = [
      { name: "create:documents" },
      { name: "edit:documents" },
      { name: "delete:documents" },
      { name: "view:documents" },
      { name: "create:users" },
      { name: "edit:users" },
      { name: "delete:users" },
      { name: "view:users" },
      { name: "approve:vacations" },
      { name: "reject:vacations" },
      { name: "create:trainings" },
      { name: "edit:trainings" },
      { name: "delete:trainings" },
      { name: "view:trainings" },
      { name: "create:document-types" },
      { name: "edit:document-types" },
      { name: "delete:document-types" },
      { name: "view:document-types" },
    ]

    for (const permission of permissions) {
      await db.permission.upsert({
        where: { name: permission.name },
        update: {},
        create: permission,
      })
    }

    // Create default roles
    const adminRole = await db.role.upsert({
      where: { name: "admin" },
      update: {},
      create: {
        name: "admin",
        description: "Администратор системы",
        permissions: {
          connect: permissions.map((p) => ({ name: p.name })),
        },
      },
    })

    const managerRole = await db.role.upsert({
      where: { name: "manager" },
      update: {},
      create: {
        name: "manager",
        description: "Руководитель",
        permissions: {
          connect: [
            { name: "create:documents" },
            { name: "edit:documents" },
            { name: "view:documents" },
            { name: "view:users" },
            { name: "approve:vacations" },
            { name: "reject:vacations" },
            { name: "create:trainings" },
            { name: "edit:trainings" },
            { name: "view:trainings" },
          ],
        },
      },
    })

    const employeeRole = await db.role.upsert({
      where: { name: "employee" },
      update: {},
      create: {
        name: "employee",
        description: "Сотрудник",
        permissions: {
          connect: [{ name: "view:documents" }],
        },
      },
    })

    // Create admin user
    const adminPassword = await hash("admin123", 10)
    const admin = await db.user.upsert({
      where: { email: "admin@aerocrm.kz" },
      update: {},
      create: {
        email: "admin@aerocrm.kz",
        password: adminPassword,
        firstName: "Админ",
        lastName: "Системы",
        position: "Системный администратор",
        department: "ИТ",
        roles: {
          connect: [{ id: adminRole.id }],
        },
      },
    })

    // Create default document types
    const documentTypes = [
      {
        name: "Приказ",
        description: "Официальный документ, содержащий указания руководства",
        requiredFields: {
          orderNumber: {
            label: "Номер приказа",
            type: "text",
            required: true,
          },
          orderDate: {
            label: "Дата приказа",
            type: "date",
            required: true,
          },
        },
      },
      {
        name: "Инструкция",
        description: "Документ, содержащий правила, указания или руководства",
        requiredFields: {
          instructionNumber: {
            label: "Номер инструкции",
            type: "text",
            required: true,
          },
          category: {
            label: "Категория",
            type: "text",
            required: true,
          },
        },
      },
      {
        name: "Сертификат",
        description: "Документ, подтверждающий квалификацию или право на деятельность",
        requiredFields: {
          certificateNumber: {
            label: "Номер сертификата",
            type: "text",
            required: true,
          },
          issueDate: {
            label: "Дата выдачи",
            type: "date",
            required: true,
          },
          issuedBy: {
            label: "Кем выдан",
            type: "text",
            required: true,
          },
        },
      },
    ]

    for (const docType of documentTypes) {
      await db.documentType.create({
        data: {
          name: docType.name,
          description: docType.description,
          requiredFields: docType.requiredFields,
        },
      })
    }

    console.log("✅ Database initialized successfully")
  } catch (error) {
    console.error("❌ Database initialization error:", error)
  }
}
