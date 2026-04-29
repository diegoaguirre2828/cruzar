// Cruzar bridge-logo glyph. Single source of truth for replacing the
// 🌉 emoji across the UI — emoji rendering varies by platform (Apple's
// is a Tokyo-tower bridge, Google's is a more generic arch, Windows
// is yet another) so the brand kept changing per device. This points
// at /public/logo-icon.svg (dark navy rounded square + white arch
// bridge silhouette).
//
// Server-side text surfaces (push notification titles, email subjects,
// cron-generated SMS) can't render <img> — keep the 🌉 emoji there.

interface Props {
  size?: number
  className?: string
  alt?: string
}

export function BridgeLogo({ size = 20, className = '', alt = 'Cruzar' }: Props) {
  return (
    <img
      src="/logo-icon.svg"
      alt={alt}
      width={size}
      height={size}
      className={`inline-block flex-shrink-0 rounded-md ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
