type IconProps = {
  className?: string;
};

function IconBase({
  className,
  children,
  strokeWidth = 1.8,
}: IconProps & {
  children: React.ReactNode;
  strokeWidth?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  );
}

export function MountainIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="m3 19 5.6-9.2L12 15l2.4-3.8L21 19H3Z" />
      <path d="m7.2 13.4 1.4-2.3 1.4 2.3" />
    </IconBase>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </IconBase>
  );
}

export function HomeIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9v11h14V9" />
      <path d="M9 20v-6h6v6" />
    </IconBase>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </IconBase>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 6.1" />
      <path d="M17.8 14.3A6.2 6.2 0 0 1 22 20" />
    </IconBase>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4.2-4.2" />
    </IconBase>
  );
}

export function PencilIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m13.5 6.5 3 3" />
    </IconBase>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M9 7V4h6v3" />
    </IconBase>
  );
}

export function XIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="m6 6 12 12M18 6 6 18" />
    </IconBase>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect height="16" rx="2.5" width="18" x="3" y="5" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </IconBase>
  );
}

export function BookOpenIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M12 6.5C10.5 5.2 8.6 4.5 6 4.5H3v13.8h3c2.6 0 4.5.7 6 2 1.5-1.3 3.4-2 6-2h3V4.5h-3c-2.6 0-4.5.7-6 2Z" />
      <path d="M12 6.5v13.8" />
    </IconBase>
  );
}

export function HelpCircleIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.1a2.7 2.7 0 0 1 5.2.9c0 1.9-2.6 2.1-2.6 4.1" />
      <path d="M12 17.2h.01" />
    </IconBase>
  );
}

export function MonitorIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect height="12" rx="2" width="18" x="3" y="5" />
      <path d="M8 21h8M12 17v4" />
    </IconBase>
  );
}

export function SunIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </IconBase>
  );
}

export function MoonIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
    </IconBase>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M12 5v14M5 12h14" />
    </IconBase>
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M4 7h9M19 7h1M4 17h1M11 17h9" />
      <circle cx="15.5" cy="7" r="2.3" />
      <circle cx="8.5" cy="17" r="2.3" />
    </IconBase>
  );
}

export function MapPinIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </IconBase>
  );
}

export function ShieldCheckIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M12 3 5 6v5.4c0 4.3 2.8 7.9 7 9.6 4.2-1.7 7-5.3 7-9.6V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </IconBase>
  );
}

export function LogOutIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="m15 8 4 4-4 4M9 12h10" />
    </IconBase>
  );
}

export function MailIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect height="14" rx="2.5" width="18" x="3" y="5" />
      <path d="m4 7 8 6 8-6" />
    </IconBase>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect height="10" rx="2.5" width="16" x="4" y="11" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </IconBase>
  );
}

export function EyeIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </IconBase>
  );
}

export function EyeOffIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="m3 3 18 18" />
      <path d="M10.6 6.1A10.8 10.8 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.2 2.8" />
      <path d="M6.3 6.8A17.3 17.3 0 0 0 2.5 12S6 18 12 18a10 10 0 0 0 4.1-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </IconBase>
  );
}

export function ArrowLeftIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M20 12H4M10 6l-6 6 6 6" />
    </IconBase>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M4 12h16M14 6l6 6-6 6" />
    </IconBase>
  );
}

export function ArrowUpIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M12 20V4M6 10l6-6 6 6" />
    </IconBase>
  );
}

export function CheckCircleIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </IconBase>
  );
}

export function AlertCircleIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5h.01" />
    </IconBase>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </IconBase>
  );
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </IconBase>
  );
}

export function MegaphoneIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="m3 11 18-5v12L3 14v-3Z" />
      <path d="M11.6 16.8a3 3 0 0 1-5.8-1" />
    </IconBase>
  );
}

export function ShareIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.7 10.5 6.6-4M8.7 13.5l6.6 4" />
    </IconBase>
  );
}

export function GoogleIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-2 3.018v2.51h3.236c1.895-1.745 2.982-4.313 2.982-7.351Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.964-.895 6.618-2.422l-3.236-2.51c-.896.6-2.04.956-3.382.956-2.605 0-4.81-1.76-5.6-4.123H3.05v2.59A9.996 9.996 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.4 13.901A6.01 6.01 0 0 1 6.086 12c0-.66.113-1.302.314-1.901V7.508H3.05A9.996 9.996 0 0 0 2 12c0 1.614.386 3.14 1.05 4.492l3.35-2.591Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C16.96 2.99 14.695 2 12 2A9.996 9.996 0 0 0 3.05 7.508l3.35 2.591C7.19 7.737 9.395 5.977 12 5.977Z"
        fill="#EA4335"
      />
    </svg>
  );
}
