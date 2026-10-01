// Marca provisional. Sustituir por el logo definitivo cuando esté en archivo.
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="#17171A" stroke="#C99A4B" strokeWidth="1.5" />
      <path d="M8 7h16" stroke="#C99A4B" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M7 11l3.2 11.5 5.8-8 5.8 8L25 11"
        fill="none"
        stroke="#EFE9DC"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
