export default function HokkumaMascot({ className = "", size = 96 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} role="img" aria-label="ホックマ">
      <circle cx="64" cy="56" r="20" fill="#fdfaf5" stroke="#2c3e50" strokeWidth="5" />
      <circle cx="136" cy="56" r="20" fill="#fdfaf5" stroke="#2c3e50" strokeWidth="5" />
      <circle cx="64" cy="58" r="8" fill="#f3c9b4" />
      <circle cx="136" cy="58" r="8" fill="#f3c9b4" />

      <path
        d="M100 38 C60 38 42 70 46 100 C48 120 58 134 68 142 C60 150 58 160 62 168 L138 168 C142 160 140 150 132 142 C142 134 152 120 154 100 C158 70 140 38 100 38 Z"
        fill="#fdfaf5"
        stroke="#2c3e50"
        strokeWidth="5"
        strokeLinejoin="round"
      />

      <ellipse cx="100" cy="118" rx="30" ry="22" fill="#fdfaf5" stroke="#2c3e50" strokeWidth="4.5" />
      <ellipse cx="100" cy="110" rx="11" ry="8" fill="#2c3e50" />

      <circle cx="76" cy="88" r="6" fill="#2c3e50" />
      <circle cx="124" cy="88" r="6" fill="#2c3e50" />
      <circle cx="74" cy="85.5" r="1.8" fill="#fff" />
      <circle cx="122" cy="85.5" r="1.8" fill="#fff" />

      <path d="M90 124 Q100 130 110 124" stroke="#2c3e50" strokeWidth="3" fill="none" strokeLinecap="round" />

      <ellipse cx="68" cy="112" rx="8" ry="5" fill="#f3b79a" opacity="0.6" />
      <ellipse cx="132" cy="112" rx="8" ry="5" fill="#f3b79a" opacity="0.6" />

      <path d="M60 150 C80 162 120 162 140 150 L140 168 C120 178 80 178 60 168 Z" fill="#d9531f" />
      <rect x="88" y="158" width="10" height="26" rx="4" fill="#c2451a" transform="rotate(8 93 171)" />
    </svg>
  );
}
