import type { ReactNode } from "react";

type IconProps = { className?: string; size?: number };

function Svg({
  size = 20,
  className = "",
  children,
}: {
  size?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconHeart({ className, size, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <Svg size={size} className={className}>
      <path
        d="M12 21c-.3 0-.6-.1-.8-.3C7.1 17.5 3 13.9 3 9.7 3 6.9 5.1 4.8 7.8 4.8c1.6 0 3.1.8 4.2 2.1 1.1-1.3 2.6-2.1 4.2-2.1 2.7 0 4.8 2.1 4.8 4.9 0 4.2-4.1 7.8-8.2 11-.2.2-.5.3-.8.3Z"
        fill={filled ? "currentColor" : "none"}
      />
    </Svg>
  );
}

export function IconPackage({ className, size }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" />
      <path d="M3 7.5v9L12 21l9-4.5v-9" />
      <path d="M12 12v9" />
    </Svg>
  );
}

export function IconWarning({ className, size }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M12 3.5 21.5 20h-19L12 3.5Z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="16.7" r="0.6" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconSearch({ className, size }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </Svg>
  );
}

export function IconBell({ className, size }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z" />
      <path d="M9.5 19a2.5 2.5 0 0 0 5 0" />
    </Svg>
  );
}

export function IconMapPin({ className, size }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M12 21s7-6.6 7-12a7 7 0 1 0-14 0c0 5.4 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.3" />
    </Svg>
  );
}

export function IconCheck({ className, size }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M4 12.5l5 5 11-11" />
    </Svg>
  );
}

export function IconCamera({ className, size }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M4 8h3l1.6-2.4a1 1 0 0 1 .8-.6h5.2a1 1 0 0 1 .8.6L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.3" />
    </Svg>
  );
}

export function IconMessage({ className, size }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4.5 3.5V17H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
    </Svg>
  );
}

export function IconCheckCircle({ className, size }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M7.5 12.5l3 3 6-6.5" />
    </Svg>
  );
}

export function IconPencil({ className, size }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M4 20l1-4.5L15.5 5 19 8.5 8.5 19 4 20Z" />
      <path d="M13 7l4 4" />
    </Svg>
  );
}

export function IconX({ className, size }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M5 5l14 14M19 5L5 19" />
    </Svg>
  );
}

export function IconMenu({ className, size }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

export function IconStar({ className, size, filled = true }: IconProps & { filled?: boolean }) {
  return (
    <Svg size={size} className={className}>
      <path
        d="M12 2.5l2.7 6.3 6.8.6-5.2 4.5 1.6 6.7L12 16.9 6.1 20.6l1.6-6.7-5.2-4.5 6.8-.6L12 2.5Z"
        fill={filled ? "currentColor" : "none"}
      />
    </Svg>
  );
}
