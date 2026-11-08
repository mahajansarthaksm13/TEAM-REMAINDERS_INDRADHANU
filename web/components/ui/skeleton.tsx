import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("rounded-md bg-chip animate-[pulse_1.4s_ease-in-out_infinite]", className)}
      {...props}
    />
  )
}

export { Skeleton }
