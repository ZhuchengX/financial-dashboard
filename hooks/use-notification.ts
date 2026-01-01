"use client"

import { useState, useCallback } from "react"

export type NotificationType = "info" | "success" | "error"

export type Notification = {
  message: string
  type: NotificationType
}

export function useNotification() {
  const [notification, setNotification] = useState<Notification | null>(null)

  const notify = useCallback((message: string, type: NotificationType = "info") => {
    setNotification({ message, type })
  }, [])

  const clearNotification = useCallback(() => {
    setNotification(null)
  }, [])

  return { notification, notify, clearNotification }
}
