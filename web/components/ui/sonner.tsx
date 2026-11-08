"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

// Bottom-right, bottom-center below 640px (Frontend Spec §A4 Toasts)
const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="dark"
    position="bottom-right"
    duration={4000}
    mobileOffset={{ bottom: 16 }}
    style={
      {
        "--normal-bg": "#313b29",
        "--normal-text": "#f5f7ef",
        "--normal-border": "#4a543d",
        "--border-radius": "14px",
        zIndex: 70,
      } as React.CSSProperties
    }
    {...props}
  />
)

export { Toaster }
