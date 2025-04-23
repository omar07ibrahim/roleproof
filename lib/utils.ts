import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistance, formatRelative, isToday, isYesterday } from "date-fns"
import { ru } from "date-fns/locale"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string) {
  return format(new Date(date), "dd.MM.yyyy", { locale: ru })
}

export function formatDateTime(date: Date | string) {
  return format(new Date(date), "dd.MM.yyyy HH:mm", { locale: ru })
}

export function formatRelativeTime(date: Date | string) {
  const dateObj = new Date(date)

  if (isToday(dateObj)) {
    return `Сегодня, ${format(dateObj, "HH:mm")}`
  }

  if (isYesterday(dateObj)) {
    return `Вчера, ${format(dateObj, "HH:mm")}`
  }

  return formatRelative(dateObj, new Date(), { locale: ru })
}

export function formatTimeAgo(date: Date | string) {
  return formatDistance(new Date(date), new Date(), { addSuffix: true, locale: ru })
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

export function hasPermission(userPermissions: string[] | undefined, requiredPermission: string) {
  if (!userPermissions) return false
  return userPermissions.includes(requiredPermission)
}

export function hasRole(userRoles: string[] | undefined, requiredRole: string) {
  if (!userRoles) return false
  return userRoles.includes(requiredRole)
}

export function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + "..."
}

export function calculateDateDifference(startDate: Date | string, endDate: Date | string) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

export function getDocumentStatusText(status: string) {
  switch (status) {
    case "DRAFT":
      return "Черновик"
    case "PUBLISHED":
      return "Опубликован"
    case "ARCHIVED":
      return "Архивирован"
    case "EXPIRED":
      return "Истек"
    default:
      return status
  }
}

export function getAssignmentStatusText(status: string) {
  switch (status) {
    case "PENDING":
      return "Ожидает ознакомления"
    case "VIEWED":
      return "Просмотрен"
    case "SIGNED":
      return "Подписан"
    case "REJECTED":
      return "Отклонен"
    default:
      return status
  }
}

export function getVacationStatusText(status: string) {
  switch (status) {
    case "PENDING":
      return "На рассмотрении"
    case "APPROVED":
      return "Одобрен"
    case "REJECTED":
      return "Отклонен"
    default:
      return status
  }
}

export function getPriorityText(priority: string) {
  switch (priority) {
    case "LOW":
      return "Низкий"
    case "NORMAL":
      return "Обычный"
    case "HIGH":
      return "Высокий"
    case "URGENT":
      return "Срочный"
    default:
      return priority
  }
}

export function getPriorityColor(priority: string) {
  switch (priority) {
    case "LOW":
      return "bg-blue-100 text-blue-800"
    case "NORMAL":
      return "bg-green-100 text-green-800"
    case "HIGH":
      return "bg-orange-100 text-orange-800"
    case "URGENT":
      return "bg-red-100 text-red-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}
