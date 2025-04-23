"use client"

import type React from "react"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { updatePassword } from "@/app/actions/auth"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface PasswordFormProps {
  userId: string
}

export function PasswordForm({ userId }: PasswordFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    const formData = new FormData(e.currentTarget)
    formData.append("userId", userId)

    const newPassword = formData.get("newPassword") as string
    const confirmPassword = formData.get("confirmPassword") as string

    if (newPassword !== confirmPassword) {
      setError("Пароли не совпадают")
      setIsSubmitting(false)
      return
    }

    try {
      const result = await updatePassword(formData)

      if (result?.error) {
        setError(result.error)
      } else if (result?.success) {
        setSuccess(result.success)
        e.currentTarget.reset()
        toast({
          title: "Успех",
          description: result.success,
        })
      }
    } catch (error) {
      setError("Не удалось обновить пароль")
      toast({
        title: "Ошибка",
        description: "Не удалось обновить пароль",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="currentPassword">Текущий пароль</Label>
        <Input id="currentPassword" name="currentPassword" type="password" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">Новый пароль</Label>
        <Input id="newPassword" name="newPassword" type="password" required minLength={8} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Подтвердите новый пароль</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Обновить пароль
        </Button>
      </div>
    </form>
  )
}
