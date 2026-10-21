export default function HokkumaMascot({ className = "", size = 96 }: { className?: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/hokkuma-mascot.png"
      width={size}
      height={size}
      alt="ホックマ"
      className={`rounded-2xl border border-stone-200 shadow-sm bg-white ${className}`}
    />
  );
}
