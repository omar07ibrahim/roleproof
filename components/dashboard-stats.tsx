"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, Doughnut, Line } from "react-chartjs-2"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js"

// Регистрируем компоненты ChartJS
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend)

interface DashboardStatsProps {
  documentStats: {
    totalDocuments: number
    documentsByStatus: { status: string; count: number }[]
    documentsByMonth: { month: string; count: number }[]
  }
  userStats: {
    totalUsers: number
    usersByDepartment: { department: string; count: number }[]
  }
  vacationStats: {
    pendingVacations: number
    approvedVacations: number
    rejectedVacations: number
    vacationsByMonth: { month: string; count: number }[]
  }
}

export function DashboardStats({ documentStats, userStats, vacationStats }: DashboardStatsProps) {
  // Данные для графика документов по статусу
  const documentStatusData = {
    labels: documentStats.documentsByStatus.map((item) =>
      item.status === "DRAFT"
        ? "Черновик"
        : item.status === "PUBLISHED"
          ? "Опубликован"
          : item.status === "ARCHIVED"
            ? "Архивирован"
            : "Истек",
    ),
    datasets: [
      {
        label: "Документы по статусу",
        data: documentStats.documentsByStatus.map((item) => item.count),
        backgroundColor: [
          "rgba(54, 162, 235, 0.6)",
          "rgba(75, 192, 192, 0.6)",
          "rgba(153, 102, 255, 0.6)",
          "rgba(255, 99, 132, 0.6)",
        ],
        borderColor: [
          "rgba(54, 162, 235, 1)",
          "rgba(75, 192, 192, 1)",
          "rgba(153, 102, 255, 1)",
          "rgba(255, 99, 132, 1)",
        ],
        borderWidth: 1,
      },
    ],
  }

  // Данные для графика пользователей по отделам
  const userDepartmentData = {
    labels: userStats.usersByDepartment.map((item) => item.department),
    datasets: [
      {
        label: "Сотрудники по отделам",
        data: userStats.usersByDepartment.map((item) => item.count),
        backgroundColor: "rgba(75, 192, 192, 0.6)",
        borderColor: "rgba(75, 192, 192, 1)",
        borderWidth: 1,
      },
    ],
  }

  // Данные для графика документов по месяцам
  const documentMonthData = {
    labels: documentStats.documentsByMonth.map((item) => item.month),
    datasets: [
      {
        label: "Документы по месяцам",
        data: documentStats.documentsByMonth.map((item) => item.count),
        fill: false,
        backgroundColor: "rgba(54, 162, 235, 0.6)",
        borderColor: "rgba(54, 162, 235, 1)",
        tension: 0.1,
      },
    ],
  }

  // Данные для графика отпусков
  const vacationData = {
    labels: ["На рассмотрении", "Одобрено", "Отклонено"],
    datasets: [
      {
        label: "Отпуска по статусу",
        data: [vacationStats.pendingVacations, vacationStats.approvedVacations, vacationStats.rejectedVacations],
        backgroundColor: ["rgba(255, 206, 86, 0.6)", "rgba(75, 192, 192, 0.6)", "rgba(255, 99, 132, 0.6)"],
        borderColor: ["rgba(255, 206, 86, 1)", "rgba(75, 192, 192, 1)", "rgba(255, 99, 132, 1)"],
        borderWidth: 1,
      },
    ],
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Всего документов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documentStats.totalDocuments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Всего сотрудников</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats.totalUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ожидающие отпуска</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vacationStats.pendingVacations}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Одобренные отпуска</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vacationStats.approvedVacations}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Документы по статусу</CardTitle>
            <CardDescription>Распределение документов по статусам</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <Doughnut
                data={documentStatusData}
                options={{
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "bottom",
                    },
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Сотрудники по отделам</CardTitle>
            <CardDescription>Распределение сотрудников по отделам</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <Bar
                data={userDepartmentData}
                options={{
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                    },
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Динамика документов</CardTitle>
            <CardDescription>Количество документов по месяцам</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <Line
                data={documentMonthData}
                options={{
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                    },
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Статус отпусков</CardTitle>
            <CardDescription>Распределение отпусков по статусам</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <Doughnut
                data={vacationData}
                options={{
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "bottom",
                    },
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
