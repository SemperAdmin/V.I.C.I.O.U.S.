import { useMemo, useState } from 'react'

export default function BrandMark() {
  const base = import.meta.env.BASE_URL || '/'
  const candidates = useMemo(() => [
    `/assets/images/logo.png`,
    `${base}assets/images/logo.png`,
    `${base}images/logo.png`,
    `${base}logo.png`,
    `/logo.png`,
    `${base}logo.png`,
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMAAQAABQABDQottQAAAABJRU5ErkJggg==',
  ], [base])
  const [idx, setIdx] = useState(0)
  const src = candidates[idx] || candidates[0]
  return (
    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
      <img
        src={src}
        alt="Semper Admin logo"
        className="h-8 w-8 flex-shrink-0 object-contain"
        onError={() => setIdx(i => (i + 1 < candidates.length ? i + 1 : i))}
      />
      <div className="flex flex-col leading-tight min-w-0">
        <span className="font-heading uppercase tracking-wider text-semper-cream text-sm sm:text-xl truncate">V.I.C.I.O.U.S.</span>
        <span className="text-xs text-semper-gold tracking-wide hidden sm:block">by Semper Admin</span>
      </div>
    </div>
  )
}
