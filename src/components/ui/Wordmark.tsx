/** "sayuj" set in the display serif, last two letters in the accent — the
 *  same device as the reference's "emoti·on". */
export function Wordmark({ size = 34, light = false }: { size?: number; light?: boolean }) {
  return (
    <span
      className={`serif ${light ? "wordmark-say" : ""}`}
      style={{ fontSize: size, lineHeight: 1, letterSpacing: "-0.01em", color: light ? "var(--white)" : "var(--deep)" }}
    >
      say<span style={{ color: "var(--orange)" }}>uj</span>
    </span>
  );
}
