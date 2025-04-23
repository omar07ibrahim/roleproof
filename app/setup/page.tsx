"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import Link from "next/link"

export default function SetupPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const initializeDatabase = async () => {
    setIsLoading(true)
    setResult(null)

    try {
      const response = await fetch("/api/init-db")
      const data = await response.json()

      setResult({
        success: data.success,
        message:
          data.message || (data.success ? "База данных успешно инициализирована" : "Ошибка инициализации базы данных"),
      })
    } catch (error) {
      setResult({
        success: false,
        message: "Произошла ошибка при инициализации базы данных",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Настройка AeroCRM</CardTitle>
          <CardDescription className="text-center">
            Инициализация базы данных и создание учетной записи администратора
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              <AlertTitle className="flex items-center">
                {result.success ? <CheckCircle className="mr-2 h-4 w-4" /> : <XCircle className="mr-2 h-4 w-4" />}
                {result.success ? "Успех" : "Ошибка"}
              </AlertTitle>
              <AlertDescription>{result.message}</AlertDescription>
            </Alert>
          )}

          <div className="text-sm text-muted-foreground">
            <p>Эта страница инициализирует базу данных и создает:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Роли (администратор, менеджер, сотрудник)</li>
              <li>Разрешения для каждой роли</li>
              <li>Учетную запись администратора</li>
              <li>Типы документов</li>
            </ul>
          </div>

          <div className="bg-muted p-3 rounded-md">
            <p className="text-sm font-medium">Данные для входа администратора:</p>
            <p className="text-sm">Email: admin@aerocrm.kz</p>
            <p className="text-sm">Пароль: admin123</p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button onClick={initializeDatabase} disabled={isLoading || (result?.success ?? false)} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Инициализация...
              </>
            ) : result?.success ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4" /> Инициализировано
              </>
            ) : (
              "Инициализировать базу данных"
            )}
          </Button>

          {result?.success && (
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Перейти на страницу входа</Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
