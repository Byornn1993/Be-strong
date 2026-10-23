/** Eigen beeldmerk: "BS" met een halterlijn. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="Be Strong" role="img">
      <defs>
        <linearGradient id="bs-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1b6b4f" />
          <stop offset="1" stopColor="#0b2a20" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#bs-g)" />
      <text x="32" y="38" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontWeight="800" fontSize="26" fill="#f1f4f2" fontStyle="italic">
        B<tspan fill="#3fe08f">S</tspan>
      </text>
      <g fill="#3fe08f">
        <rect x="16" y="46" width="32" height="2.5" rx="1.25" />
        <rect x="13" y="43" width="3" height="8.5" rx="1" />
        <rect x="48" y="43" width="3" height="8.5" rx="1" />
      </g>
    </svg>
  );
}
