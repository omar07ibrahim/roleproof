"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn, formatDate } from "@/lib/utils"
import { CalendarIcon } from "lucide-react"
import { requestVacation } from "@/app/actions/vacations"
import { useToast } from "@/hooks/use-toast"

interface VacationRequestFormProps {
  userId: string
}

export function VacationRequestForm({ userId }: VacationRequestFormProps) {
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!startDate || !endDate) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, выберите даты начала и окончания отпуска",
        variant: "destructive",
      })
      return
    }

    if (startDate > endDate) {
      toast({
        title: "Ошибка",
        description: "Дата начала не может быть позже даты окончания",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const formData = new FormData()
      formData.append("userId", userId)
      formData.append("startDate", startDate.toISOString())
      formData.append("endDate", endDate.toISOString())

      await requestVacation(formData)

      toast({
        title: "Запрос отправлен",
        description: "Ваш запрос на отпуск был успешно отправлен",
      })

      // Reset form
      setStartDate(undefined)
      setEndDate(undefined)
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось отправить запрос на отпуск",
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
          <label className="text-sm font-medium">Дата начала</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? formatDate(startDate) : "Выберите дату"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Дата окончания</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? formatDate(endDate) : "Выберите дату"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0)) || (startDate && date < startDate)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Отправка..." : "Запросить отпуск"}
      </Button>
    </form>
  )
}
