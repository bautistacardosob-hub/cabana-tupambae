const isOptimizable = (source: string) =>
  Boolean(source) &&
  !source.startsWith("data:") &&
  !source.toLowerCase().includes(".svg") &&
  !source.startsWith("/.netlify/images");

export function optimizedImageUrl(source: string, width: number, quality = 78) {
  if (process.env.NODE_ENV !== "production" || !isOptimizable(source)) return source;
  const params = new URLSearchParams({
    url: source,
    w: String(Math.max(1, Math.round(width))),
    q: String(Math.min(100, Math.max(1, Math.round(quality)))),
  });
  return `/.netlify/images?${params.toString()}`;
}
