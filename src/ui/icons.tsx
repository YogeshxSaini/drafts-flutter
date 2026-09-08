import { type SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true
});

export function IconInbox({ size = 18, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M3 12h4l2 3h6l2-3h4" />
      <path d="M5 7l-2 5v6a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6l-2-5a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1Z" />
    </svg>
  );
}

export function IconPin({ size = 18, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M12 17v5" />
      <path d="M9 4h6l-1 5 3 3-1 1H8l-1-1 3-3-1-5Z" />
    </svg>
  );
}

export function IconArchive({ size = 18, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

export function IconTrash({ size = 18, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M5 6l1 14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-14" />
    </svg>
  );
}

export function IconTag({ size = 18, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M20.59 13.41 12 22l-9-9V4h9l8.59 8.59a2 2 0 0 1 0 2.82Z" />
      <circle cx="8" cy="9" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function IconSearch({ size = 18, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

export function IconPlus({ size = 18, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconMenu({ size = 18, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function IconClose({ size = 18, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconMore({ size = 18, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="6" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="18" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

export function IconCheck({ size = 18, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <path d="m5 12 5 5L20 6" />
    </svg>
  );
}

export function IconArrowLeft({ size = 18, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

export function IconSun({ size = 18, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function IconMoon({ size = 18, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

export function IconNote({ size = 18, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6" />
    </svg>
  );
}

export function IconCommand({ size = 18, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3Z" />
    </svg>
  );
}

export function IconBold({ size = 16, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7Z" />
      <path d="M7 12h7a3.5 3.5 0 0 1 0 7H7Z" />
    </svg>
  );
}

export function IconItalic({ size = 16, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M10 5h8M6 19h8M14 5l-4 14" />
    </svg>
  );
}

export function IconHeading({ size = 16, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M6 4v16M18 4v16M6 12h12" />
    </svg>
  );
}

export function IconLink({ size = 16, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M10 13a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7L11 6" />
      <path d="M14 11a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7L13 18" />
    </svg>
  );
}

export function IconList({ size = 16, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M9 6h12M9 12h12M9 18h12" />
      <circle cx="4" cy="6" r="1" fill="currentColor" />
      <circle cx="4" cy="12" r="1" fill="currentColor" />
      <circle cx="4" cy="18" r="1" fill="currentColor" />
    </svg>
  );
}

export function IconChecklist({ size = 16, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M3 6h2M3 12h2M3 18h2" />
      <path d="m7 6 2 2 4-4" />
      <path d="m7 12 2 2 4-4" />
      <path d="m7 18 2 2 4-4" />
    </svg>
  );
}

export function IconCode({ size = 16, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <path d="m9 8-5 4 5 4M15 8l5 4-5 4" />
    </svg>
  );
}

export function IconQuote({ size = 16, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M7 7h4v4H7c0 3 1 4 4 5M13 7h4v4h-4c0 3 1 4 4 5" />
    </svg>
  );
}

export function IconUnarchive({ size = 18, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <path d="m12 11-3 3M12 11l3 3M12 11v6" />
    </svg>
  );
}

export function IconSort({ size = 18, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M7 4v16M3 8l4-4 4 4M17 20V4M21 16l-4 4-4-4" />
    </svg>
  );
}

export function IconSidebar({ size = 18, ...p }: Props) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
  );
}
