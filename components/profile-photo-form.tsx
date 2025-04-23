"use client"

import { Input } from "@/components/ui/input"
import type React from "react"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { uploadProfilePhoto } from "@/app/actions/users"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, Upload, X } from "lucide-react"
import { getInitials } from "@/lib/utils"

interface ProfilePhotoFormProps {
  userId: string
  userName?: string
  currentPhotoUrl?: string | null
}

export function ProfilePhotoForm({ userId, userName = "", currentPhotoUrl = null }: ProfilePhotoFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      setPhoto(file)

      // Create preview URL
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    }
  }

  const handleClearPhoto = () => {
    setPhoto(null)
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    if (!photo) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, выберите фото",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    const formData = new FormData()
    formData.append("userId", userId)
    formData.append("photo", photo)

    try {
      const result = await uploadProfilePhoto(formData)

      if (result?.error) {
        toast({
          title: "Ошибка",
          description: result.error,
          variant: "destructive",
        })
      } else if (result?.success) {
        toast({
          title: "Успех",
          description: result.success,
        })
        handleClearPhoto()
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить фото профиля",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center space-x-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={previewUrl || currentPhotoUrl || ""} alt="Фото профиля" />
          <AvatarFallback className="text-2xl">{getInitials(userName)}</AvatarFallback>
        </Avatar>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Выбрать фото
            </Button>

            {previewUrl && (
              <Button type="button" variant="outline" size="sm" onClick={handleClearPhoto}>
                <X className="mr-2 h-4 w-4" />
                Очистить
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Рекомендуемый размер: 256x256 пикселей. Поддерживаемые форматы: JPG, PNG.
          </p>
        </div>
      </div>

      <Input
        ref={fileInputRef}
        id="photo"
        name="photo"
        type="file"
        accept="image/*"
        onChange={handlePhotoChange}
        className="hidden"
      />

      {previewUrl && (
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Сохранить фото
          </Button>
        </div>
      )}
    </form>
  )
}
