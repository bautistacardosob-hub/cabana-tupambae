export function hasAnimalValue(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  return Boolean(text && !/^(?:-|—|n\/a|sin dato|sin cargar)$/i.test(text));
}

export function formatAnimalPercentile(value: string | null | undefined): string {
  if (!hasAnimalValue(value)) return "";
  const text = value!.trim();
  const match = text.match(/^(?:top\s*)?(\d+(?:[.,]\d+)?)\s*%?$/i);
  return match ? `Top ${match[1].replace(",", ".")}%` : text;
}
