// The site mark — a blue rounded square monogram. Mirrors app/icon.svg (the
// favicon); keep the two in sync if the design changes.
export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="32" height="32" rx="8" fill="#2563eb" />
      <text
        x="16"
        y="22"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="15"
        fontWeight="700"
        fill="#ffffff"
        textAnchor="middle"
      >
        PB
      </text>
    </svg>
  );
}
