export type AnimalImageFit = "cover" | "contain";

export type AnimalImagePresentation = {
  source: string;
  fit: AnimalImageFit;
  x: number;
  y: number;
  homeFit: AnimalImageFit;
  homeX: number;
  homeY: number;
};

type AnimalMediaImage = {
  kind?: string | null;
  url?: string | null;
  storageKey?: string | null;
};

const fallbackImage = "/animal-black.jpg";
const fitKey = "display_fit";
const xKey = "display_x";
const yKey = "display_y";
const homeFitKey = "home_fit";
const homeXKey = "home_x";
const homeYKey = "home_y";

const clampPercent = (value: string | null, fallback: number) => {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, Math.round(parsed))) : fallback;
};

const parseUrl = (source: string) => {
  try {
    return new URL(source, "https://cabana.local");
  } catch {
    return null;
  }
};

export function readAnimalImagePresentation(value?: string | null): AnimalImagePresentation {
  const source = value?.trim() || fallbackImage;
  const url = parseUrl(source);
  if (!url) return { source, fit: "cover", x: 50, y: 50, homeFit: "cover", homeX: 50, homeY: 50 };
  const fit = url.searchParams.get(fitKey) === "contain" ? "contain" : "cover";
  const x = clampPercent(url.searchParams.get(xKey), 50);
  const y = clampPercent(url.searchParams.get(yKey), 50);
  const homeFit = url.searchParams.get(homeFitKey) === "contain" ? "contain" : fit;
  const homeX = clampPercent(url.searchParams.get(homeXKey), x);
  const homeY = clampPercent(url.searchParams.get(homeYKey), y);
  url.searchParams.delete(fitKey);
  url.searchParams.delete(xKey);
  url.searchParams.delete(yKey);
  url.searchParams.delete(homeFitKey);
  url.searchParams.delete(homeXKey);
  url.searchParams.delete(homeYKey);
  const cleanSource = url.origin === "https://cabana.local"
    ? `${url.pathname}${url.search}${url.hash}`
    : url.toString();
  return { source: cleanSource, fit, x, y, homeFit, homeX, homeY };
}

export function writeAnimalImagePresentation(source: string, fit: AnimalImageFit, x: number, y: number, homeFit = fit, homeX = x, homeY = y) {
  const clean = readAnimalImagePresentation(source).source;
  const url = parseUrl(clean);
  if (!url) return clean;
  if (fit !== "cover") url.searchParams.set(fitKey, fit);
  if (x !== 50) url.searchParams.set(xKey, String(clampPercent(String(x), 50)));
  if (y !== 50) url.searchParams.set(yKey, String(clampPercent(String(y), 50)));
  if (homeFit !== fit) url.searchParams.set(homeFitKey, homeFit);
  if (homeX !== x) url.searchParams.set(homeXKey, String(clampPercent(String(homeX), x)));
  if (homeY !== y) url.searchParams.set(homeYKey, String(clampPercent(String(homeY), y)));
  return url.origin === "https://cabana.local"
    ? `${url.pathname}${url.search}${url.hash}`
    : url.toString();
}

function storageKeyFromImage(value?: string | null) {
  const source = readAnimalImagePresentation(value).source;
  const url = parseUrl(source);
  return url?.pathname === "/api/media" ? url.searchParams.get("key") : null;
}

export function resolveAnimalPrimaryImage(value: string | null | undefined, media: AnimalMediaImage[]) {
  const images = media.filter(item => item.kind === "image" && item.url);
  const requestedKey = storageKeyFromImage(value);
  if (!requestedKey) return value?.trim() || images[0]?.url || fallbackImage;
  const current = images.find(item => item.storageKey === requestedKey);
  if (current?.url) {
    const presentation = readAnimalImagePresentation(value);
    return writeAnimalImagePresentation(current.url, presentation.fit, presentation.x, presentation.y, presentation.homeFit, presentation.homeX, presentation.homeY);
  }
  return images[0]?.url || fallbackImage;
}
