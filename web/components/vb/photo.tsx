import Image from "next/image"
import { cn } from "cn"

// Duotone photography, the same treatment as the login stage: greyscale photo, Violet in the
// shadows (multiply), Orchid in the highlights (screen), Night fading where text sits. Keeps every
// photo inside the four-colour palette. Photos: Unsplash License, served from Unsplash's CDN.
export const PHOTOS = {
  pile: { id: "photo-1595278069441-2cf29f8005a4", alt: "A large pile of discarded plastic bottles and cans waiting for recycling" },
  river: { id: "photo-1793371382356-efbc528d643b", alt: "Plastic bottles floating in a river choked with algae" },
  street: { id: "photo-1792779793110-2369acaa0a61", alt: "Plastic waste being swept off a street with a straw broom" },
  cage: { id: "photo-1642631171488-23d631eba638", alt: "Plastic bottles compressed in a recycling cage" },
} as const

const src = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1800&q=70`

export function DuoPhoto({
  photo,
  priority,
  sizes = "(min-width: 1200px) 1180px, 100vw",
  position = "50% 50%",
  fade = "bottom",
  drift,
  decorative,
}: {
  photo: keyof typeof PHOTOS
  priority?: boolean
  sizes?: string
  position?: string
  fade?: "bottom" | "left" | "even"
  drift?: boolean // slow push-in, for the hero only
  decorative?: boolean
}) {
  const p = PHOTOS[photo]
  return (
    <div className="duo" aria-hidden={decorative || undefined}>
      <Image src={src(p.id)} alt={decorative ? "" : p.alt} fill priority={priority} sizes={sizes} className={cn("duo-img", drift && "duo-drift")} style={{ objectPosition: position }} />
      <div className="auth-tone-violet" />
      <div className="auth-tone-orchid" />
      <div className={`duo-fade-${fade}`} />
    </div>
  )
}
