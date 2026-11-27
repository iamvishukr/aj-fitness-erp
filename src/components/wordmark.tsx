/** AJ FITNESS wordmark: heavy uppercase lettering with a thick underline, as on the gym's printed material. */
export function Wordmark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <span role="img" aria-label="AJ Fitness" className={`inline-flex flex-col items-stretch text-ink ${className}`}>
      <span className="font-brand uppercase leading-[0.9] whitespace-nowrap" style={{ fontSize: size, letterSpacing: "-0.01em" }}>
        AJ FITNESS
      </span>
      <span className="block bg-accent rounded-[1px]" style={{ height: Math.max(2, Math.round(size * 0.11)), marginTop: Math.round(size * 0.14) }} />
    </span>
  );
}
