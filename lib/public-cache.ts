export function publicCacheHeaders(seconds = 30) {
  return {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Netlify-CDN-Cache-Control": `public, durable, max-age=${seconds}, stale-while-revalidate=300`,
  };
}

export const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
};
