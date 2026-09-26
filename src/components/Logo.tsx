/** Cranoly mark: a hex lattice with a glowing node at its centre. */
export default function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      <path d="M16 2.8 27.4 9.4v13.2L16 29.2 4.6 22.6V9.4Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 16v13.2M16 16 4.6 9.4M16 16l11.4-6.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
      <circle cx="16" cy="16" r="3.4" fill="currentColor" />
    </svg>
  );
}
