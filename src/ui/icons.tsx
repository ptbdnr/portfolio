/** Line icons for the interface (24×24, drawn with the current text colour). */
import type { ReactNode } from 'react'

const svg = (children: ReactNode) => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

export const Icon = {
  map: () => svg(<path d="M9 4L3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4zM9 4v13.5M15 6.5V20" />),
  book: () => svg(<path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5zM4 20.5A2.5 2.5 0 006.5 23H20M8 7h8M8 10.5h6" />),
  binoculars: () =>
    svg(
      <>
        <circle cx="6.5" cy="15.5" r="3.5" />
        <circle cx="17.5" cy="15.5" r="3.5" />
        <path d="M10 15.5h4M5 12l2-7h3l1 7M19 12l-2-7h-3l-1 7" />
      </>,
    ),
  camera: () =>
    svg(
      <>
        <path d="M3 8.5A2.5 2.5 0 015.5 6h2l1.5-2h6l1.5 2h2A2.5 2.5 0 0121 8.5v9a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 17.5z" />
        <circle cx="12" cy="13" r="4" />
      </>,
    ),
  sound: () => svg(<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4zM15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" />),
  muted: () => svg(<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4zM16 9.5l5 5M21 9.5l-5 5" />),
  menu: () => svg(<path d="M4 7h16M4 12h16M4 17h16" />),
  close: () => svg(<path d="M6 6l12 12M18 6L6 18" />),
  info: () =>
    svg(
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7.5v.5" />
      </>,
    ),
  arrowUp: () => svg(<path d="M12 19V5M6 11l6-6 6 6" />),
  play: () => svg(<path d="M8 5.5v13l11-6.5z" />),
  pause: () => svg(<path d="M8 5v14M16 5v14" />),
  sun: () =>
    svg(
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
      </>,
    ),
  moon: () => svg(<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />),
  help: () =>
    svg(
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5a2.5 2.5 0 114 2c-1 .7-1.5 1.2-1.5 2.5M12 17v.5" />
      </>,
    ),
  download: () => svg(<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />),
  trash: () => svg(<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" />),
  mail: () =>
    svg(
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3.5 6.5L12 13l8.5-6.5" />
      </>,
    ),
}
