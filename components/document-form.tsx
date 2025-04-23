"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { createDocument, updateDocument } from "@/app/actions/documents"
import { useRouter } from "next/navigation"
import { MultiSelect } from "@/components/multi-select"
import { Card, CardContent } from "@/components/ui/card"
import { CalendarIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn, formatDate } from "@/lib/utils"

interface DocumentFormProps {
  documentTypes: {
    id: string
    name: string
    requiredFields: any
  }[]
  users: {
    id: string
    firstName: string
    lastName: string
    middleName?: string | null
    department: string
  }[]
  currentUserId: string
  document?: {
    id: string
    title: string
    content?: string | null
    documentTypeId: string
    metadata: any
    status: string
    expirationDate?: Date | null
  }
}

export function DocumentForm({ documentTypes, users, currentUserId, document }: DocumentFormProps) {
  const router = useRouter()
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>(document?.documentTypeId || "")
  const [requiredFields, setRequiredFields] = useState<any>(document?.metadata || {})

  const formSchema = z.object({
    title: z.string().min(1, "Название документа обязательно"),
    content: z.string().optional(),
    documentTypeId: z.string().min(1, "Тип документа обязателен"),
    metadata: z.record(z.string(), z.any()).optional(),
    status: z.string().min(1, "Статус документа обязателен"),
    expirationDate: z.date().optional().nullable(),
    assignees: z.array(z.string()).optional(),
  })

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: document?.title || "",
      content: document?.content || "",
      documentTypeId: document?.documentTypeId || "",
      metadata: document?.metadata || {},
      status: document?.status || "DRAFT",
      expirationDate: document?.expirationDate ? new Date(document.expirationDate) : null,
      assignees: [],
    },
  })

  const handleDocumentTypeChange = (value: string) => {
    setSelectedDocumentType(value)
    form.setValue("documentTypeId", value)

    const selectedType = documentTypes.find((type) => type.id === value)
    if (selectedType) {
      const newRequiredFields = selectedType.requiredFields
      setRequiredFields(newRequiredFields)
      form.setValue("metadata", {})
    }
  }

  const handleMetadataChange = (field: string, value: string) => {
    const currentMetadata = form.getValues("metadata") || {}
    form.setValue("metadata", {
      ...currentMetadata,
      [field]: value,
    })
  }

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    const formData = new FormData()

    if (document) {
      formData.append("documentId", document.id)
    }

    formData.append("title", data.title)
    formData.append("content", data.content || "")
    formData.append("documentTypeId", data.documentTypeId)
    formData.append("uploaderId", currentUserId)
    formData.append("metadata", JSON.stringify(data.metadata || {}))
    formData.append("status", data.status)

    if (data.expirationDate) {
      formData.append("expirationDate", data.expirationDate.toISOString())
    }

    if (data.assignees && data.assignees.length > 0) {
      data.assignees.forEach((assignee) => {
        formData.append("assignees", assignee)
      })
    }

    if (document) {
      await updateDocument(formData)
    } else {
      await createDocument(formData)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Название документа</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="documentTypeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Тип документа</FormLabel>
                <Select onValueChange={handleDocumentTypeChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите тип документа" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {documentTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Содержание документа</FormLabel>
              <FormControl>
                <Textarea {...field} rows={5} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedDocumentType && Object.keys(requiredFields).length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">Дополнительные поля</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(requiredFields).map(([field, config]: [string, any]) => (
                  <div key={field} className="space-y-2">
                    <Label htmlFor={field}>{config.label || field}</Label>
                    <Input
                      id={field}
                      type={config.type || "text"}
                      value={(form.getValues("metadata") || {})[field] || ""}
                      onChange={(e) => handleMetadataChange(field, e.target.value)}
                      required={config.required}
                    />
                    {config.description && <p className="text-sm text-muted-foreground">{config.description}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Статус документа</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите статус" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="DRAFT">Черновик</SelectItem>
                    <SelectItem value="PUBLISHED">Опубликован</SelectItem>
                    <SelectItem value="ARCHIVED">Архивирован</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="expirationDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Срок действия</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                      >
                        {field.value ? formatDate(field.value) : <span>Выберите дату</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value || undefined}
                      onSelect={field.onChange}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormDescription>Дата окончания срока действия документа</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {!document && (
          <FormField
            control={form.control}
            name="assignees"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Назначить сотрудникам</FormLabel>
                <FormControl>
                  <MultiSelect
                    options={users.map((user) => ({
                      value: user.id,
                      label: `${user.lastName} ${user.firstName} ${user.middleName || ""} (${user.department})`,
                    }))}
                    selected={field.value || []}
                    onChange={field.onChange}
                    placeholder="Выберите сотрудников"
                  />
                </FormControl>
                <FormDescription>Выберите сотрудников, которым нужно ознакомиться с документом</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Отмена
          </Button>
          <Button type="submit">{document ? "Обновить документ" : "Создать документ"}</Button>
        </div>
      </form>
    </Form>
  )
}
