"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateProfile } from "@/app/actions/auth"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ProfileFormProps {
  user: {
    id: string
    firstName: string
    lastName: string
    middleName?: string | null
    position: string
    department: string
    phoneNumber?: string | null
  }
  departments: string[]
}

export function ProfileForm({ user, departments }: ProfileFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const formData = new FormData(e.currentTarget)
      formData.append("userId", user.id)
      await updateProfile(formData)

      toast({
        title: "Профиль обновлен",
        description: "Ваши данные успешно сохранены",
      })

      router.refresh()
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить профиль",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">Имя</Label>
          <Input id="firstName" name="firstName" defaultValue={user.firstName} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Фамилия</Label>
          <Input id="lastName" name="lastName" defaultValue={user.lastName} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="middleName">Отчество</Label>
        <Input id="middleName" name="middleName" defaultValue={user.middleName || ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="position">Должность</Label>
        <Input id="position" name="position" defaultValue={user.position} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="department">Отдел</Label>
        <Select name="department" defaultValue={user.department}>
          <SelectTrigger>
            <SelectValue placeholder="Выберите отдел" />
          </SelectTrigger>
          <SelectContent>
            {departments.map((department) => (
              <SelectItem key={department} value={department}>
                {department}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="phoneNumber">Телефон</Label>
        <Input id="phoneNumber" name="phoneNumber" defaultValue={user.phoneNumber || ""} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Сохранить изменения
        </Button>
      </div>
    </form>
  )
}
