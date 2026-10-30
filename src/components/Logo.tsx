/** Beeldmerk = app-icoon: donker vlak zonder rand, grote gouden halter in het midden. */
export function Logo({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="Be Strong" role="img" className="shrink-0">
      <rect width="64" height="64" rx="17" fill="var(--brand-bg)" />
      <g fill="var(--brand-gold)">
        <rect x="14" y="30" width="36" height="4" rx="2" />
        <rect x="11" y="19" width="6" height="26" rx="2.5" />
        <rect x="47" y="19" width="6" height="26" rx="2.5" />
        <rect x="5" y="24" width="5" height="16" rx="2" />
        <rect x="54" y="24" width="5" height="16" rx="2" />
      </g>
      <rect x="11" y="19" width="6" height="3" rx="1.5" fill="var(--brand-champ)" opacity=".55" />
      <rect x="47" y="19" width="6" height="3" rx="1.5" fill="var(--brand-champ)" opacity=".55" />
    </svg>
  );
}
