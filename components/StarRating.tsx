"use client";

export default function StarRating({
  value,
  onChange,
  size = 20,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={onChange ? () => onChange(n) : undefined}
          disabled={!onChange}
          className={onChange ? "cursor-pointer" : "cursor-default"}
          style={{ fontSize: size, lineHeight: 1 }}
          aria-label={`${n}`}
        >
          <span className={n <= value ? "text-orange-500" : "text-stone-300"}>★</span>
        </button>
      ))}
    </div>
  );
}
