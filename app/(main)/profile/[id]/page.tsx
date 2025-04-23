import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getInitials } from "@/lib/utils"
import { ProfileForm } from "@/components/profile-form"
import { PasswordForm } from "@/components/password-form"
import { ProfilePhotoForm } from "@/components/profile-photo-form"
import Link from "next/link"

export default async function ProfilePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const user = await db.user.findUnique({
    where: {
      id: params.id,
    },
    include: {
      roles: true,
    },
  })

  if (!user) {
    notFound()
  }

  // Check if current user is viewing their own profile
  const isOwnProfile = session.user.id === user.id

  // Check if current user can edit other profiles
  const canEditOtherProfiles = session.user.permissions.includes("edit:users") || session.user.roles.includes("admin")

  const canEdit = isOwnProfile || canEditOtherProfiles

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Профиль</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={user.photoUrl || ""} alt={`${user.firstName} ${user.lastName}`} />
                <AvatarFallback className="text-2xl">
                  {getInitials(`${user.firstName} ${user.lastName}`)}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <h2 className="text-xl font-bold">
                  {user.lastName} {user.firstName} {user.middleName}
                </h2>
                <p className="text-muted-foreground">{user.position}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Отдел</p>
                <p>{user.department}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p>{user.email}</p>
              </div>
              {user.phoneNumber && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Телефон</p>
                  <p>{user.phoneNumber}</p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Роли</p>
                <div className="flex flex-wrap gap-2">
                  {user.roles.map((role) => (
                    <span
                      key={role.id}
                      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                    >
                      {role.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
          {isOwnProfile && (
            <CardFooter>
              <Button asChild variant="outline" className="w-full">
                <Link href="/settings">Настройки</Link>
              </Button>
            </CardFooter>
          )}
        </Card>

        {canEdit && (
          <div className="md:col-span-2 space-y-6">
            <Tabs defaultValue="profile" className="space-y-4">
              <TabsList>
                <TabsTrigger value="profile">Профиль</TabsTrigger>
                {isOwnProfile && <TabsTrigger value="password">Пароль</TabsTrigger>}
                {isOwnProfile && <TabsTrigger value="photo">Фото</TabsTrigger>}
              </TabsList>
              <TabsContent value="profile" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Информация профиля</CardTitle>
                    <CardDescription>Обновите информацию о профиле</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ProfileForm user={user} />
                  </CardContent>
                </Card>
              </TabsContent>
              {isOwnProfile && (
                <TabsContent value="password" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Изменить пароль</CardTitle>
                      <CardDescription>Обновите свой пароль</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <PasswordForm userId={user.id} />
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
              {isOwnProfile && (
                <TabsContent value="photo" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Фото профиля</CardTitle>
                      <CardDescription>Обновите фото профиля</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ProfilePhotoForm userId={user.id} />
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          </div>
        )}
      </div>
    </div>
  )
}
