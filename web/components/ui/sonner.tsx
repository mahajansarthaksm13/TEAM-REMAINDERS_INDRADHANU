"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

// Bottom-right, bottom-center below 640px (Frontend Spec §A4 Toasts)
const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="light"
    position="bottom-right"
    duration={4000}
    mobileOffset={{ bottom: 16 }}
    style={
      {
        "--normal-bg": "#1f261a",
        "--normal-text": "#f5f7ef",
        "--normal-border": "#1f261a",
        "--border-radius": "14px",
        zIndex: 70,
      } as React.CSSProperties
    }
    {...props}
  />
)

export { Toaster }
