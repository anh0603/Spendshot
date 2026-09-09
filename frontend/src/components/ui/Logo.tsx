export function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="SpendShot"
      width={size}
      height={size}
      className={`rounded-[10px] shrink-0 ${className}`}
      draggable={false}
    />
  );
}
