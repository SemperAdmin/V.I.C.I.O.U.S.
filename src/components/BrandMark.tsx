import { useMemo, useState } from 'react'

export default function BrandMark() {
  const base = import.meta.env.BASE_URL || '/'
  const candidates = useMemo(() => [
    // 1x1 transparent PNG default to avoid network errors when logo is missing
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMAAQAABQABDQottQAAAABJRU5ErkJggg==',
    `${base}assets/images/logo.png`,
    `${base}images/logo.png`,
    `${base}logo.png`,
    `/assets/images/logo.png`,
    `/logo.png`,
    `${base}vite.svg`,
    `/vite.svg`,
  ], [base])
  const [idx, setIdx] = useState(0)
  const src = candidates[idx] || candidates[0]
  return (
    <div className="flex items-center gap-3">
      <img
        src={src}
        alt="Semper Admin logo"
        className="h-8 w-8 object-contain"
        onError={() => setIdx(i => (i + 1 < candidates.length ? i + 1 : i))}
      />
      <div className="flex flex-col leading-tight">
        <span className="font-heading uppercase tracking-wider text-semper-cream text-xl">Process Point</span>
        <span className="text-xs text-semper-gold tracking-wide">by Semper Admin</span>
      </div>
    </div>
  )
}
