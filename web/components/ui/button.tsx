import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Buttons carry the reference's flow sweep (globals.css .flow-btn): a circle slides in from the
// bottom-right on hover, the label flips, the control grows to 1.05 and presses to 0.95.
//   default  the one Sage Mist control per view; sweeps to Olive Black, label goes Sage Mist
//   secondary/outline  olive material; sweeps Sage Mist, label goes Olive Black
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl font-semibold whitespace-nowrap outline-none select-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "skeu-btn-lit flow-btn flow-btn-invert text-on-lit",
        secondary: "skeu-btn flow-btn text-ink",
        outline: "skeu-btn flow-btn text-ink",
        ghost: "rounded-xl text-dim transition-colors duration-200 hover:bg-panel-hi hover:text-ink",
        destructive: "flow-btn border border-error/60 bg-error/15 text-error [&::before]:bg-error hover:text-on-lit",
        link: "rounded-none px-0 text-dim underline-offset-4 transition-colors hover:text-ink hover:underline",
        // kept for existing call sites on dark sections
        dark: "skeu-btn-lit flow-btn flow-btn-invert text-on-lit",
        darkGhost: "skeu-btn flow-btn text-ink",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        default: "h-11 px-5 text-[15px]",
        lg: "h-12 px-7 text-base tracking-wide",
        icon: "size-10 rounded-xl",
        "icon-sm": "size-8 rounded-lg",
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
