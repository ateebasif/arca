import type { SVGProps } from 'react';

/** Small inline icon set (no icon dependency). 16px, stroke = currentColor. */

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 3.5 10.5 8 6 12.5" />
  </Icon>
);

export const FolderIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M1.75 4.25c0-.83.67-1.5 1.5-1.5h3l1.5 1.75h5c.83 0 1.5.67 1.5 1.5v6.25c0 .83-.67 1.5-1.5 1.5h-9.5c-.83 0-1.5-.67-1.5-1.5Z" />
  </Icon>
);

export const BarIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2" />
    <path d="M1.75 6h12.5" />
  </Icon>
);

export const SidebarIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2" />
    <path d="M6 2.75v10.5" />
  </Icon>
);

export const GridIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2" y="2" width="5" height="5" rx="1.25" />
    <rect x="9" y="2" width="5" height="5" rx="1.25" />
    <rect x="2" y="9" width="5" height="5" rx="1.25" />
    <rect x="9" y="9" width="5" height="5" rx="1.25" />
  </Icon>
);

export const ListIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5.5 4h8.5M5.5 8h8.5M5.5 12h8.5M2.25 4h.5M2.25 8h.5M2.25 12h.5" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="m10.5 10.5 3.25 3.25" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 3v10M3 8h10" />
  </Icon>
);

export const SortIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 3v10M2.5 11l2 2 2-2M11.5 13V3M9.5 5l2-2 2 2" />
  </Icon>
);

export const DensityIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.5 3.5h11M2.5 8h11M2.5 12.5h11" />
  </Icon>
);

export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.25" y="7" width="9.5" height="6.5" rx="1.5" />
    <path d="M5.25 7V5.25a2.75 2.75 0 0 1 5.5 0V7" />
  </Icon>
);

export const MoreIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="3.5" cy="8" r=".75" fill="currentColor" />
    <circle cx="8" cy="8" r=".75" fill="currentColor" />
    <circle cx="12.5" cy="8" r=".75" fill="currentColor" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </Icon>
);

export const GearIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="2" />
    <path d="M8 1.75v1.5M8 12.75v1.5M14.25 8h-1.5M3.25 8h-1.5M12.4 3.6l-1.06 1.06M4.66 11.34 3.6 12.4M12.4 12.4l-1.06-1.06M4.66 4.66 3.6 3.6" />
  </Icon>
);

export const SunIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="2.75" />
    <path d="M8 1.5v1.25M8 13.25v1.25M14.5 8h-1.25M2.75 8H1.5M12.6 3.4l-.9.9M4.3 11.7l-.9.9M12.6 12.6l-.9-.9M4.3 4.3l-.9-.9" />
  </Icon>
);

export const MoonIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13.5 9.5A5.75 5.75 0 0 1 6.5 2.5a5.75 5.75 0 1 0 7 7Z" />
  </Icon>
);

export const MonitorIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="1.75" y="2.5" width="12.5" height="8.5" rx="1.5" />
    <path d="M5.5 13.5h5M8 11v2.5" />
  </Icon>
);

export const LinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.75 9.25a2.75 2.75 0 0 0 3.9 0l2-2a2.76 2.76 0 0 0-3.9-3.9l-.6.6" />
    <path d="M9.25 6.75a2.75 2.75 0 0 0-3.9 0l-2 2a2.76 2.76 0 0 0 3.9 3.9l.6-.6" />
  </Icon>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12.5 8h-9M7 4 3 8l4 4" />
  </Icon>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 8h9M9 4l4 4-4 4" />
  </Icon>
);

export const KeyboardIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="1.75" y="4" width="12.5" height="8" rx="1.5" />
    <path d="M4.5 6.75h.01M7 6.75h.01M9.5 6.75h.01M12 6.75h.01M5 9.5h6" />
  </Icon>
);

export const SparkleIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 2.25 9.3 6.7l4.45 1.3-4.45 1.3L8 13.75 6.7 9.3 2.25 8l4.45-1.3Z" />
    <path d="M13 1.75v2.5M11.75 3h2.5" />
  </Icon>
);
