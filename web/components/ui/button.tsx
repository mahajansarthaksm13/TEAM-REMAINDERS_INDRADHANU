import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Pill buttons per Frontend Spec §A4
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent font-semibold whitespace-nowrap transition-[background-color,color,transform] duration-150 ease-(--ease-out) outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-olive-700 text-garden-50 hover:bg-olive-950 active:scale-[0.98] active:bg-olive-950",
        secondary: "border-sage-600 bg-transparent text-olive-950 hover:bg-sage-200 active:bg-sage-200",
        outline: "border-sage-600 bg-transparent text-olive-950 hover:bg-sage-200 active:bg-sage-200",
        ghost: "text-olive-700 hover:bg-sage-200 active:bg-sage-200",
        destructive: "bg-error text-garden-50 hover:bg-[#86321f]",
        dark: "bg-sage-200 text-olive-950 hover:bg-garden-50",
        darkGhost: "border-olive-700 text-garden-50 hover:bg-olive-700",
        link: "rounded-none px-0 text-olive-700 underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3.5 text-sm",
        default: "h-10 px-5 text-[15px]",
        lg: "h-12 px-7 text-base",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button"
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
