import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { animals, geneticData, pedigreeMembers } from "../db/schema";
import { readAnimalImagePresentation } from "./animal-image";
import { formatAnimalPercentile, hasAnimalValue } from "./animal-display";
import { registrationDisplayLabel } from "./animal-labels";
import { getPublicSiteUrl } from "./site-identity";
import { mediaBucket } from "./storage";

export type PdfAnimal = typeof animals.$inferSelect & {
  pedigree: Array<typeof pedigreeMembers.$inferSelect>;
  deps: Array<typeof geneticData.$inferSelect>;
};

const size: [number, number] = [595.28, 841.89];
const ink = rgb(.11, .22, .23);
const quiet = rgb(.4, .46, .46);
const rule = rgb(.82, .86, .86);
const cream = rgb(.965, .957, .935);
const safe = (value: unknown) => String(value ?? "").replace(/[\u2010-\u2015]/g, "-").replace(/[^\x20-\x7e\u00a0-\u00ff]/g, " ").trim();
export const animalPdfSlug = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function fit(value: string, font: PDFFont, fontSize: number, width: number) {
  const text = safe(value);
  if (font.widthOfTextAtSize(text, fontSize) <= width) return text;
  let end = text.length;
  while (end && font.widthOfTextAtSize(`${text.slice(0, end)}...`, fontSize) > width) end--;
  return `${text.slice(0, end).trimEnd()}...`;
}

function wrap(value: string, font: PDFFont, fontSize: number, width: number) {
  const rows: string[] = [];
  for (const paragraph of safe(value).split(/\n/)) {
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = current ? `${current} ${word}` : word;
      if (current && font.widthOfTextAtSize(next, fontSize) > width) { rows.push(current); current = word; }
      else current = next;
    }
    if (current) rows.push(current);
  }
  return rows;
}

async function image(source: string | null | undefined, origin: string, logo = false): Promise<Uint8Array | null> {
  if (!source) return null;
  try {
    const url = new URL(source, origin);
    const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
    if (url.origin !== origin && url.origin !== supabase) return null;
    if (url.origin === origin && url.pathname === "/api/media") {
      const key = url.searchParams.get("key");
      if (!key || !(logo ? ["site/brand-logo/", "site/brand-pdf/"].some(prefix => key.startsWith(prefix)) : key.startsWith("animals/"))) return null;
      return image(mediaBucket().publicUrl(key), origin, logo);
    }
    let bytes: Uint8Array;
    if (url.origin === origin && /^\/[a-z0-9._-]+\.(?:jpe?g|png|webp|svg)$/i.test(url.pathname)) {
      bytes = new Uint8Array(await readFile(join(process.cwd(), "public", url.pathname.slice(1))));
    } else {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok || Number(response.headers.get("content-length") || 0) > 12_000_000) return null;
      bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > 12_000_000) return null;
    }
    const resized = sharp(bytes).rotate().resize(logo ? 600 : 900, logo ? 300 : 600, { fit: "inside", withoutEnlargement: true });
    if (logo) {
      const { data, info } = await resized.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      // Keep the mark's alpha channel while making its strokes legible on the dark PDF header.
      for (let index = 0; index < data.length; index += 4) {
        data[index] = 240;
        data[index + 1] = 246;
        data[index + 2] = 243;
      }
      return new Uint8Array(await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer());
    }
    return new Uint8Array(await resized.jpeg({ quality: 74 }).toBuffer());
  } catch { return null; }
}

function label(page: PDFPage, value: string, x: number, y: number, font: PDFFont, width = 480) {
  page.drawText(fit(value.toUpperCase(), font, 8, width), { x, y, size: 8, font, color: quiet });
}

export async function createAnimalPdf(records: PdfAnimal[], cabinName: string, logoSource: string | null, origin: string) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(records.length === 1 ? `${records[0].name} - RP ${records[0].rp} | ${cabinName}` : `Catálogo de animales | ${cabinName}`);
  pdf.setAuthor(cabinName);
  const logoBytes = await image(logoSource, origin, true);
  const logo = logoBytes ? await pdf.embedPng(logoBytes) : null;
  const photos = new Map<number, Uint8Array | null>();
  for (let start = 0; start < records.length; start += 6) {
    await Promise.all(records.slice(start, start + 6).map(async animal => {
      photos.set(animal.id, await image(readAnimalImagePresentation(animal.image).source, origin));
    }));
  }

  for (const animal of records) {
    const page = pdf.addPage(size);
    const horse = animal.catalogSection === "criollos";
    const url = `${getPublicSiteUrl()}/${horse ? "criollos" : "genetica"}/${animal.id}-${animalPdfSlug(animal.name)}`;
    page.drawRectangle({ x: 0, y: 753, width: size[0], height: 89, color: ink });
    if (logo) {
      const scale = Math.min(210 / logo.width, 59 / logo.height);
      page.drawImage(logo, { x: 42, y: 768 + (59 - logo.height * scale) / 2, width: logo.width * scale, height: logo.height * scale });
    } else {
      page.drawText(fit(cabinName.toUpperCase(), bold, 13, 230), { x: 42, y: 795, size: 13, font: bold, color: rgb(1, 1, 1) });
    }
    const qr = await pdf.embedPng(await QRCode.toDataURL(url, { margin: 1, width: 200 }));
    page.drawImage(qr, { x: 500, y: 766, width: 63, height: 63 });
    page.drawText(horse ? "FICHA CRIOLLA" : "FICHA INDIVIDUAL", { x: 331, y: 803, size: 9, font: bold, color: rgb(.91, .95, .94) });
    page.drawText("ESCANEÁ PARA VERLA ONLINE", { x: 331, y: 786, size: 7, font: regular, color: rgb(.77, .84, .83) });

    const photo = photos.get(animal.id);
    page.drawRectangle({ x: 42, y: 542, width: 220, height: 190, color: cream });
    if (photo) {
      const embedded = await pdf.embedJpg(photo);
      const scale = Math.min(220 / embedded.width, 190 / embedded.height);
      page.drawImage(embedded, { x: 42 + (220 - embedded.width * scale) / 2, y: 542 + (190 - embedded.height * scale) / 2, width: embedded.width * scale, height: embedded.height * scale });
    }
    label(page, `${animal.breed} · RP ${animal.rp}`, 282, 716, bold, 270);
    const titleRows = wrap(animal.name, bold, 19, 275).slice(0, 3);
    titleRows.forEach((row, index) => page.drawText(row, { x: 282, y: 685 - index * 23, size: 19, font: bold, color: ink }));
    page.drawText(fit(animal.type, regular, 10, 260), { x: 282, y: 601, size: 10, font: regular, color: quiet });
    if (animal.sold) page.drawText("VENDIDO", { x: 282, y: 574, size: 9, font: bold, color: ink });

    const facts = ([
      [animal.rpLabel || "RP", animal.rp],
      [animal.birthDateLabel || "Nacimiento", animal.birthDate],
      [registrationDisplayLabel(animal.registrationLabel), animal.registration],
      [animal.coatLabel || "Pelaje", animal.coat],
      [animal.birthWeightLabel || (horse ? "Sexo" : "Peso al nacer"), animal.birthWeight],
      [animal.weaningWeightLabel || (horse ? "Categoría" : "Peso al destete"), animal.weaningWeight],
      [animal.scrotalCircumferenceLabel || (horse ? "Marcha" : "Circ. escrotal"), animal.scrotalCircumference],
      [animal.frameLabel || "Frame", animal.frame],
    ] as Array<[string, string | null | undefined]>).filter(([key, value]) => hasAnimalValue(key) && hasAnimalValue(value));
    const factRows = Math.ceil(facts.length / 2);
    const factHeight = Math.max(42, factRows * 18 + 16);
    const factTop = 529;
    page.drawRectangle({ x: 42, y: factTop - factHeight, width: 511, height: factHeight, color: cream });
    facts.forEach(([key, value], index) => {
      const x = 51 + (index % 2) * 255, y = factTop - 17 - Math.floor(index / 2) * 18;
      page.drawText(fit(`${key}:`, bold, 8, 100), { x, y, size: 8, font: bold, color: quiet });
      page.drawText(fit(value || "", regular, 9, 138), { x: x + 102, y, size: 9, font: regular, color: ink });
    });

    let cursor = factTop - factHeight - 20;
    if (hasAnimalValue(animal.description)) {
      label(page, "EL EJEMPLAR", 42, cursor, bold);
      cursor -= 15;
      const rows = wrap(animal.description!, regular, 8.5, 510);
      // Fit editorial copy into the remaining space, keeping the pedigree and genetics below.
      const allowance = Math.max(2, Math.min(rows.length, Math.floor((cursor - 245) / 11)));
      rows.slice(0, allowance).forEach(row => { page.drawText(row, { x: 42, y: cursor, size: 8.5, font: regular, color: ink }); cursor -= 11; });
      cursor -= 12;
    }

    const pedigree = animal.pedigree.filter(item => hasAnimalValue(item.name));
    if (pedigree.length) {
      label(page, "GENEALOGÍA", 42, cursor, bold);
      cursor -= 16;
      const names: Record<string, string> = { sire: "Padre", dam: "Madre", paternal_grandsire: "Abuelo paterno", paternal_granddam: "Abuela paterna", maternal_grandsire: "Abuelo materno", maternal_granddam: "Abuela materna" };
      const rowHeight = pedigree.length > 6 ? 14 : 17;
      for (const member of pedigree) {
        page.drawText(fit(names[member.relation] || member.relation, regular, 8, 113), { x: 49, y: cursor, size: 8, font: regular, color: quiet });
        page.drawText(fit([member.name, member.registration].filter(hasAnimalValue).join(" · "), regular, 8.5, 383), { x: 166, y: cursor, size: 8.5, font: regular, color: ink });
        page.drawLine({ start: { x: 42, y: cursor - 5 }, end: { x: 553, y: cursor - 5 }, thickness: .35, color: rule });
        cursor -= rowHeight;
      }
      cursor -= 13;
    }

    const deps = animal.deps.filter(item => hasAnimalValue(item.label) && hasAnimalValue(item.value));
    if (deps.length) {
      label(page, horse ? "CARACTERÍSTICAS" : "EVALUACIÓN GENÉTICA", 42, cursor, bold);
      cursor -= 17;
      const available = cursor - 44;
      const rowHeight = Math.min(19, available / (deps.length + 1));
      if (rowHeight < 10) throw new Error(`La ficha de ${animal.name} contiene demasiadas evaluaciones para una hoja.`);
      page.drawRectangle({ x: 42, y: cursor - rowHeight + 3, width: 511, height: rowHeight, color: ink });
      const headings = horse ? ["CARACTERÍSTICA", "VALOR", "PRECISIÓN", "TOP"] : ["CARACTERÍSTICA", "DEP", "PRECISIÓN", "TOP"];
      [49, 313, 383, 467].forEach((x, i) => page.drawText(headings[i], { x, y: cursor - rowHeight + 8, size: 7, font: bold, color: rgb(1, 1, 1) }));
      cursor -= rowHeight;
      for (const dep of deps) {
        page.drawText(fit(dep.label, regular, 8, 250), { x: 49, y: cursor - rowHeight + 8, size: 8, font: regular, color: ink });
        page.drawText(fit(dep.value, bold, 8, 60), { x: 313, y: cursor - rowHeight + 8, size: 8, font: bold, color: ink });
        if (hasAnimalValue(dep.precision)) page.drawText(fit(dep.precision!, regular, 8, 74), { x: 383, y: cursor - rowHeight + 8, size: 8, font: regular, color: ink });
        const percentile = formatAnimalPercentile(dep.percentile);
        if (percentile) page.drawText(fit(percentile, bold, 8, 80), { x: 467, y: cursor - rowHeight + 8, size: 8, font: bold, color: ink });
        page.drawLine({ start: { x: 42, y: cursor - rowHeight + 3 }, end: { x: 553, y: cursor - rowHeight + 3 }, thickness: .35, color: rule });
        cursor -= rowHeight;
      }
    }
    page.drawLine({ start: { x: 42, y: 31 }, end: { x: 553, y: 31 }, thickness: .5, color: rule });
    page.drawText(fit(`${cabinName} · Información suministrada por la cabaña`, regular, 7, 450), { x: 42, y: 18, size: 7, font: regular, color: quiet });
    page.drawText(`${pdf.getPageCount()}`, { x: 541, y: 18, size: 7, font: regular, color: quiet });
  }
  return Buffer.from(await pdf.save());
}
