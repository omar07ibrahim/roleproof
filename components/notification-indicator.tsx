"use client"

import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface NotificationIndicatorProps {
  count: number
}

export function NotificationIndicator({ count }: NotificationIndicatorProps) {
  return (
    <Button variant="ghost" size="icon" asChild className="relative">
      <Link href="/notifications">
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute top-0 right-0 h-4 w-4 rounded-full bg-destructive text-xs text-white flex items-center justify-center">
            {count > 9 ? "9+" : count}
          </span>
        )}
        <span className="sr-only">Уведомления</span>
      </Link>
    </Button>
  )
}
