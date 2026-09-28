import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readAnimalImagePresentation, writeAnimalImagePresentation, resolveAnimalPrimaryImage, validAnimalPhotoDate } from "../lib/animal-image.ts";

test("photo dates survive saving and cover resolution without entering the image request", () => {
  const value = writeAnimalImagePresentation("/api/media?key=animals/test.jpg", "cover", 40, 50, "contain", 50, 50, "2026-08-19");
  const image = readAnimalImagePresentation(value);
  assert.equal(image.photoDate, "2026-08-19");
  assert.equal(new URL(image.source, "https://cabana.local").searchParams.get("key"), "animals/test.jpg");
  assert.equal(new URL(image.source, "https://cabana.local").searchParams.has("photo_date"), false);
  const resolved = resolveAnimalPrimaryImage(value, [{ kind: "image", storageKey: "animals/test.jpg", url: "/api/media?key=animals/test.jpg" }]);
  assert.equal(readAnimalImagePresentation(resolved).photoDate, "2026-08-19");
  assert.equal(validAnimalPhotoDate("2026-02-30"), "");
  assert.equal(validAnimalPhotoDate("19/08/2026"), "");
  assert.equal(readAnimalImagePresentation(writeAnimalImagePresentation(value, "cover", 50, 50, "cover", 50, 50, "")).photoDate, "");
});

test("individual and bulk PDFs use configured contact and generation date", async () => {
  const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");
  const renderer = await read("lib/animal-pdf.ts");
  assert.match(renderer, /Generado el/);
  assert.match(renderer, /setCreationDate/);
  assert.match(renderer, /Foto tomada el/);
  assert.match(renderer, /Contacto:/);
  for (const path of ["app/api/animals/pdf/route.ts", "app/api/animals/[id]/pdf/route.ts"]) {
    const route = await read(path);
    assert.match(route, /contact_phone/);
    assert.match(route, /contact_email/);
    assert.match(route, /origin, contact\)/);
  }
});
