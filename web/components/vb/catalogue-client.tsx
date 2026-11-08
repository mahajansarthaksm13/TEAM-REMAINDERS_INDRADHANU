"use client"

import { useActionState, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { approve, createProduct, type ProductState } from "@/lib/actions"
import { CATEGORIES, CATEGORY_DESC, CATEGORY_LABEL } from "@/lib/shared"
import { FieldError, Notice } from "./ui"

const select = "h-10 w-full skeu-inset rounded-input text-ink px-3 text-sm focus-visible:ring-2 focus-visible:ring-lit focus-visible:outline-none aria-invalid:border-error"

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <FieldError id={`${id}-err`}>{error}</FieldError>}
    </div>
  )
}

export function AddProductDialog() {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<ProductState, FormData>(async (prev, fd) => {
    const r = await createProduct(prev, fd)
    if (r.ok) {
      setOpen(false)
      toast.success("Product added — pending approval.")
    }
    return r
  }, {})
  const f = state.fields ?? {}
  const err = (k: string) => (f[k] ? { "aria-invalid": true, "aria-describedby": `${k}-err` } : {})

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        <Button><Plus />Add product</Button>
      </DialogTrigger>
      <DialogContent onInteractOutside={(e) => pending && e.preventDefault()} onEscapeKeyDown={(e) => pending && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Add product</DialogTitle>
          <DialogDescription>New products need admin approval before QR codes can be issued.</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4" noValidate>
          {state.error && <Notice kind="error">{state.error}</Notice>}
          <Field id="name" label="Product name" error={f.name}>
            <Input id="name" name="name" {...err("name")} />
          </Field>
          <Field id="barcode" label="Barcode (EAN/UPC)" error={f.barcode}>
            <Input id="barcode" name="barcode" inputMode="numeric" {...err("barcode")} />
          </Field>
          <Field id="category" label="EPR category" error={f.category}>
            <select id="category" name="category" defaultValue="" className={select} {...err("category")}>
              <option value="" disabled>Pick a category</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]} · {CATEGORY_DESC[c]}</option>)}
            </select>
          </Field>
          <Field id="weight" label="Catalogue weight (g)" error={f.weight}>
            <Input id="weight" name="weight" inputMode="numeric" pattern="[0-9]*" {...err("weight")} />
          </Field>
          <DialogFooter className="mt-2 flex-row justify-end gap-2">
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Add product</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ApproveButton({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  async function go() {
    setPending(true)
    const r = await approve(id).catch(() => ({ error: "Couldn't approve. Try again." }))
    setPending(false)
    if ("error" in r && r.error) return toast.error(r.error)
    setOpen(false)
    toast.success(`${name} approved.`)
    router.refresh()
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        <Button size="sm">Approve</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve product?</DialogTitle>
          <DialogDescription>{name} will be able to receive QR codes and its scans will count toward targets.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="secondary" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={go} disabled={pending}>{pending && <Loader2 className="animate-spin" />}Approve</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
