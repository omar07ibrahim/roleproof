"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { signDocument, viewDocument, rejectDocument } from "@/app/actions/documents"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Check, Eye, X, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatDateTime } from "@/lib/utils"

interface DocumentActionsProps {
  assignment: {
    id: string
    status: string
    signedAt: Date | null
    viewedAt: Date | null
    rejectedAt: Date | null
    rejectReason: string | null
  }
}

export function DocumentActions({ assignment }: DocumentActionsProps) {
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const handleView = async () => {
    if (assignment.status === "PENDING") {
      setIsSubmitting(true)
      try {
        const formData = new FormData()
        formData.append("assignmentId", assignment.id)
        await viewDocument(formData)
        toast({
          title: "Документ отмечен как просмотренный",
          description: "Статус документа обновлен",
        })
      } catch (error) {
        toast({
          title: "Ошибка",
          description: "Не удалось обновить статус документа",
          variant: "destructive",
        })
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  const handleSign = async () => {
    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append("assignmentId", assignment.id)
      await signDocument(formData)
      toast({
        title: "Документ подписан",
        description: "Документ успешно подписан",
      })
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось подписать документ",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, укажите причину отклонения",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append("assignmentId", assignment.id)
      formData.append("reason", rejectReason)
      await rejectDocument(formData)
      setIsRejectDialogOpen(false)
      toast({
        title: "Документ отклонен",
        description: "Документ успешно отклонен",
      })
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось отклонить документ",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // If already signed or rejected, show status
  if (assignment.status === "SIGNED") {
    return (
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Вы подписали этот документ {assignment.signedAt && formatDateTime(assignment.signedAt)}
        </p>
        <Button variant="outline" size="sm" disabled>
          <Check className="mr-2 h-4 w-4" />
          Подписано
        </Button>
      </div>
    )
  }

  if (assignment.status === "REJECTED") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Вы отклонили этот документ {assignment.rejectedAt && formatDateTime(assignment.rejectedAt)}
          </p>
          <Button variant="outline" size="sm" disabled>
            <X className="mr-2 h-4 w-4" />
            Отклонено
          </Button>
        </div>
        {assignment.rejectReason && (
          <div className="rounded-md bg-muted p-3">
            <p className="text-sm font-medium">Причина отклонения:</p>
            <p className="text-sm">{assignment.rejectReason}</p>
          </div>
        )}
      </div>
    )
  }

  // If pending or viewed, show actions
  return (
    <div className="flex flex-col space-y-4">
      {assignment.status === "PENDING" && (
        <Button onClick={handleView} variant="outline" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
          Отметить как просмотренное
        </Button>
      )}

      {assignment.status === "VIEWED" && (
        <p className="text-sm text-muted-foreground">
          Вы просмотрели этот документ {assignment.viewedAt && formatDateTime(assignment.viewedAt)}
        </p>
      )}

      <div className="flex space-x-4">
        <Button onClick={handleSign} className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
          Подписать
        </Button>

        <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" className="flex-1" disabled={isSubmitting}>
              <X className="mr-2 h-4 w-4" />
              Отклонить
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Отклонить документ</DialogTitle>
              <DialogDescription>Пожалуйста, укажите причину отклонения документа.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Причина</Label>
                <Textarea
                  id="reason"
                  placeholder="Укажите причину отклонения"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRejectDialogOpen(false)}
                disabled={isSubmitting}
              >
                Отмена
              </Button>
              <Button type="button" variant="destructive" onClick={handleReject} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Отклонить"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
