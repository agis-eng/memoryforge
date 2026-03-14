export function Logo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="MemoryForge logo"
    >
      {/* Central node */}
      <circle cx="24" cy="24" r="5" fill="currentColor" opacity="0.9" />
      
      {/* Orbital nodes */}
      <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.5" />
      <circle cx="36" cy="12" r="3" fill="currentColor" opacity="0.5" />
      <circle cx="12" cy="36" r="3" fill="currentColor" opacity="0.5" />
      <circle cx="36" cy="36" r="3" fill="currentColor" opacity="0.5" />
      <circle cx="8" cy="24" r="2.5" fill="currentColor" opacity="0.35" />
      <circle cx="40" cy="24" r="2.5" fill="currentColor" opacity="0.35" />
      <circle cx="24" cy="8" r="2.5" fill="currentColor" opacity="0.35" />
      <circle cx="24" cy="40" r="2.5" fill="currentColor" opacity="0.35" />
      
      {/* Connection lines */}
      <line x1="24" y1="24" x2="12" y2="12" stroke="currentColor" strokeWidth="1" opacity="0.25" />
      <line x1="24" y1="24" x2="36" y2="12" stroke="currentColor" strokeWidth="1" opacity="0.25" />
      <line x1="24" y1="24" x2="12" y2="36" stroke="currentColor" strokeWidth="1" opacity="0.25" />
      <line x1="24" y1="24" x2="36" y2="36" stroke="currentColor" strokeWidth="1" opacity="0.25" />
      <line x1="24" y1="24" x2="8" y2="24" stroke="currentColor" strokeWidth="0.75" opacity="0.2" />
      <line x1="24" y1="24" x2="40" y2="24" stroke="currentColor" strokeWidth="0.75" opacity="0.2" />
      <line x1="24" y1="24" x2="24" y2="8" stroke="currentColor" strokeWidth="0.75" opacity="0.2" />
      <line x1="24" y1="24" x2="24" y2="40" stroke="currentColor" strokeWidth="0.75" opacity="0.2" />
      
      {/* Cross connections */}
      <line x1="12" y1="12" x2="36" y2="12" stroke="currentColor" strokeWidth="0.5" opacity="0.15" />
      <line x1="12" y1="36" x2="36" y2="36" stroke="currentColor" strokeWidth="0.5" opacity="0.15" />
      <line x1="12" y1="12" x2="12" y2="36" stroke="currentColor" strokeWidth="0.5" opacity="0.15" />
      <line x1="36" y1="12" x2="36" y2="36" stroke="currentColor" strokeWidth="0.5" opacity="0.15" />
    </svg>
  );
}
