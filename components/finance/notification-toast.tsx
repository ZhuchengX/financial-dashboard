"use client"

import { useEffect } from "react"
import { Check, AlertCircle } from "lucide-react"
import type { Notification } from "@/hooks/use-notification"

type NotificationToastProps = {
  notification: Notification
  onClose: () => void
}

export function NotificationToast({ notification, onClose }: NotificationToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className={`flex items-center gap-2 px-6 py-3 rounded-full text-white text-sm shadow-lg animate-in fade-in slide-in-from-top-2 ${
        notification.type === "success" ? "bg-green-600" : notification.type === "error" ? "bg-red-600" : "bg-gray-800"
      }`}
    >
      {notification.type === "success" && <Check className="w-4 h-4" />}
      {notification.type === "error" && <AlertCircle className="w-4 h-4" />}
      {notification.message}
    </div>
  )
}
