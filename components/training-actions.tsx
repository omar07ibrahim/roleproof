"use client"

import { Button } from "@/components/ui/button"
import { completeTraining } from "@/app/actions/trainings"
import { Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface TrainingActionsProps {
  training: {
    id: string
    completed: boolean
    startDate: Date
    endDate: Date
  }
}

export function TrainingActions({ training }: TrainingActionsProps) {
  const { toast } = useToast()

  const handleComplete = async () => {
    const formData = new FormData()
    formData.append("trainingId", training.id)
    await completeTraining(formData)

    toast({
      title: "Обучение завершено",
      description: "Статус обучения обновлен",
    })
  }

  // If already completed or not yet started, don't show actions
  if (training.completed || new Date(training.startDate) > new Date()) {
    return null
  }

  return (
    <Button onClick={handleComplete} className="w-full">
      <Check className="mr-2 h-4 w-4" />
      Отметить как завершенное
    </Button>
  )
}
