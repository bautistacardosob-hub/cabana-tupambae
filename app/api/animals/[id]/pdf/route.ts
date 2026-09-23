import { and, asc, eq } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getDb } from "../../../../../db";
import { animals, geneticData, pedigreeMembers, siteContent } from "../../../../../db/schema";
import { readAnimalImagePresentation } from "../../../../../lib/animal-image";
import { formatAnimalPercentile, hasAnimalValue } from "../../../../../lib/animal-display";
import { registrationDisplayLabel } from "../../../../../lib/animal-labels";
import { getPublicSiteUrl } from "../../../../../lib/site-identity";
import { mediaBucket } from "../../../../../lib/storage";

export const runtime = "nodejs";
const cabinId = Number(process.env.NEXT_PUBLIC_CABIN_ID || 1);
const pageSize: [number, number] = [595.28, 841.89];
const ink = rgb(.17, .21, .17);
const muted = rgb(.43, .46, .41);
const accent = rgb(.58, .38, .25);
const line = rgb(.83, .83, .79);

const printable = (value: unknown) => String(value ?? "").replace(/[\u2010-\u2015]/g, "-").replace(/[\u2022\u25cf]/g, "·").replace(/[^\x20-\x7e\u00a0-\u00ff]/g, " ").trim();
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function lines(value: string, font: PDFFont, size: number, width: number) {
  const result: string[] = [];
  for (const paragraph of printable(value).split(/\n/)) {
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = current ? `${current} ${word}` : word;
      if (current && font.widthOfTextAtSize(next, size) > width) { result.push(current); current = word; }
      else current = next;
    }
    if (current) result.push(current);
  }
  return result;
}

function drawLines(page: PDFPage, value: string, x: number, top: number, width: number, size: number, font: PDFFont, color = ink, leading = size * 1.4) {
  const rows = lines(value, font, size, width);
  rows.forEach((row, index) => page.drawText(row, { x, y: top - index * leading, size, font, color }));
  return top - rows.length * leading;
}

function field(page: PDFPage, label: string, value: string | null | undefined, x: number, top: number, width: number, regular: PDFFont, bold: PDFFont) {
  if (!hasAnimalValue(label) || !hasAnimalValue(value)) return;
  page.drawText(printable(label).toUpperCase(), { x, y: top, size: 8, font: bold, color: muted });
  drawLines(page, value!, x, top - 19, width, 13, regular);
}

async function imageBytes(source: string, requestOrigin: string): Promise<Uint8Array | null> {
  try {
    const url = new URL(source, requestOrigin);
    const allowedOrigin = new URL(requestOrigin).origin;
    const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
    if (url.origin !== allowedOrigin && url.origin !== supabaseOrigin) return null;
    if (url.origin === allowedOrigin && url.pathname === "/api/media") {
      const key = url.searchParams.get("key");
      if (!key || !key.startsWith("animals/")) return null;
      return imageBytes(mediaBucket().publicUrl(key), requestOrigin);
    }
    let original: Uint8Array;
    if (url.origin === allowedOrigin && /^\/[a-z0-9._-]+\.(jpe?g|png|webp)$/i.test(url.pathname)) {
      original = new Uint8Array(await readFile(join(process.cwd(), "public", url.pathname.slice(1))));
    } else {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok || Number(response.headers.get("content-length") || 0) > 12_000_000) return null;
      original = new Uint8Array(await response.arrayBuffer());
      if (original.length > 12_000_000) return null;
    }
    return new Uint8Array(await sharp(original).rotate().resize(1200, 900, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 76 }).toBuffer());
  } catch { return null; }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return new Response("Ficha no disponible", { status: 404 });
  try {
    const db = getDb();
    const [animal] = await db.select().from(animals).where(and(eq(animals.id, id), eq(animals.cabinId, cabinId), eq(animals.status, "published"))).limit(1);
    if (!animal) return new Response("Ficha no disponible", { status: 404 });
    const [pedigree, deps, brand] = await Promise.all([
      db.select().from(pedigreeMembers).where(eq(pedigreeMembers.animalId, id)).orderBy(asc(pedigreeMembers.sortOrder)),
      db.select().from(geneticData).where(eq(geneticData.animalId, id)).orderBy(asc(geneticData.sortOrder)),
      db.select({ value: siteContent.value }).from(siteContent).where(and(eq(siteContent.cabinId, cabinId), eq(siteContent.contentKey, "brand_name"))).limit(1),
    ]);
    const cabinName = brand[0]?.value || "Cabaña";
    const catalog = animal.catalogSection === "criollos" ? "criollos" : "genetica";
    const requestOrigin = new URL(request.url).origin;
    const animalUrl = `${getPublicSiteUrl()}/${catalog}/${id}-${slugify(animal.name)}`;
    const qr = await QRCode.toDataURL(animalUrl, { errorCorrectionLevel: "M", margin: 1, width: 280 });
    const pdf = await PDFDocument.create();
    pdf.setTitle(`${animal.name} · RP ${animal.rp} | ${cabinName}`);
    pdf.setAuthor(cabinName);
    pdf.setSubject("Ficha individual del ejemplar");
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const page = pdf.addPage(pageSize);
    const [pageWidth, pageHeight] = pageSize;
    const margin = 42;
    page.drawRectangle({ x: 0, y: pageHeight - 11, width: pageWidth, height: 11, color: accent });
    page.drawText(printable(cabinName).toUpperCase().slice(0, 60), { x: margin, y: pageHeight - 45, size: 10, font: bold, color: accent });
    page.drawText(catalog === "criollos" ? "FICHA CRIOLLA" : "FICHA GENÉTICA", { x: margin, y: pageHeight - 69, size: 9, font: bold, color: muted });
    const titleLines = lines(animal.name, bold, 28, 410).slice(0, 2);
    titleLines.forEach((text, index) => page.drawText(text, { x: margin, y: pageHeight - 106 - index * 31, size: 28, font: bold, color: ink }));
    page.drawText(printable(`${animal.type} · ${animal.breed}`).slice(0, 90), { x: margin, y: pageHeight - 168, size: 11, font: regular, color: muted });
    if (animal.sold) page.drawText("VENDIDO", { x: pageWidth - 104, y: pageHeight - 168, size: 10, font: bold, color: accent });
    page.drawLine({ start: { x: margin, y: pageHeight - 185 }, end: { x: pageWidth - margin, y: pageHeight - 185 }, thickness: 1, color: line });

    const source = readAnimalImagePresentation(animal.image).source;
    const photo = await imageBytes(source, requestOrigin);
    if (photo) {
      const embedded = await pdf.embedJpg(photo);
      const box = { x: margin, y: pageHeight - 430, width: pageWidth - margin * 2, height: 225 };
      const scale = Math.min(box.width / embedded.width, box.height / embedded.height);
      const width = embedded.width * scale, height = embedded.height * scale;
      page.drawRectangle({ ...box, color: rgb(.95, .94, .91) });
      page.drawImage(embedded, { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height });
    }
    const horse = catalog === "criollos";
    const facts: Array<[string, string | null | undefined]> = [
      [animal.rpLabel || "RP", animal.rp],
      [animal.birthDateLabel || "Nacimiento", animal.birthDate],
      [registrationDisplayLabel(animal.registrationLabel), animal.registration],
      [animal.coatLabel || "Pelaje", animal.coat],
      [animal.birthWeightLabel || (horse ? "Sexo" : "Peso al nacer"), animal.birthWeight],
      [animal.weaningWeightLabel || (horse ? "Categoría" : "Peso al destete"), animal.weaningWeight],
      [animal.scrotalCircumferenceLabel || (horse ? "Marcha" : "Circ. escrotal"), animal.scrotalCircumference],
      [animal.frameLabel || "Frame", animal.frame],
    ];
    facts.filter(([label, value]) => hasAnimalValue(label) && hasAnimalValue(value)).forEach(([label, value], index) => {
      const column = index % 3;
      field(page, label, value, [margin, 178, 368][column], pageHeight - 460 - Math.floor(index / 3) * 61, [115, 145, 175][column], regular, bold);
    });
    page.drawLine({ start: { x: margin, y: 112 }, end: { x: pageWidth - margin, y: 112 }, thickness: 1, color: line });
    const qrImage = await pdf.embedPng(qr);
    page.drawImage(qrImage, { x: pageWidth - margin - 73, y: 28, width: 73, height: 73 });
    page.drawText("ESCANEÁ PARA VER LA FICHA ACTUALIZADA", { x: margin, y: 74, size: 8, font: bold, color: muted });
    drawLines(page, animalUrl, margin, 57, pageWidth - margin * 2 - 90, 7, regular, accent, 10);

    const visiblePedigree = pedigree.filter(member => hasAnimalValue(member.name));
    const visibleDeps = deps.filter(dep => hasAnimalValue(dep.label) && hasAnimalValue(dep.value));
    if (animal.description || visiblePedigree.length || visibleDeps.length) {
      let details = pdf.addPage(pageSize);
      details.drawText(printable(animal.name), { x: margin, y: pageHeight - 56, size: 22, font: bold, color: ink });
      details.drawText(`RP ${printable(animal.rp)} · ${printable(cabinName)}`, { x: margin, y: pageHeight - 79, size: 10, font: regular, color: muted });
      let top = pageHeight - 120;
      const nextPage = () => {
        details.drawText(`Ficha online: ${animalUrl}`, { x: margin, y: 32, size: 8, font: regular, color: accent });
        details = pdf.addPage(pageSize);
        details.drawText(printable(animal.name), { x: margin, y: pageHeight - 56, size: 22, font: bold, color: ink });
        top = pageHeight - 104;
      };
      if (animal.description) {
        details.drawText("EL EJEMPLAR", { x: margin, y: top, size: 10, font: bold, color: accent });
        top -= 23;
        for (const row of lines(animal.description, regular, 10, pageWidth - margin * 2)) {
          if (top < 68) nextPage();
          details.drawText(row, { x: margin, y: top, size: 10, font: regular, color: ink });
          top -= 15;
        }
        top -= 20;
      }
      if (visiblePedigree.length) {
        if (top < 160) nextPage();
        details.drawText("PEDIGREE", { x: margin, y: top, size: 10, font: bold, color: accent });
        top -= 24;
        const names: Record<string, string> = { sire: "Padre", dam: "Madre", paternal_grandsire: "Abuelo paterno", paternal_granddam: "Abuela paterna", maternal_grandsire: "Abuelo materno", maternal_granddam: "Abuela materna" };
        for (const member of visiblePedigree) {
          if (top < 68) nextPage();
          details.drawText(printable(names[member.relation] || member.relation), { x: margin, y: top, size: 9, font: regular, color: muted });
          drawLines(details, member.name, 195, top, 330, 10, bold);
          top -= 25;
        }
        top -= 18;
      }
      if (visibleDeps.length) {
        if (top < 90) nextPage();
        details.drawText(horse ? "CARACTERÍSTICAS" : "DATOS GENÉTICOS", { x: margin, y: top, size: 10, font: bold, color: accent });
        top -= 23;
        const hasPrecision = visibleDeps.some(dep => hasAnimalValue(dep.precision));
        const hasPercentile = visibleDeps.some(dep => hasAnimalValue(dep.percentile));
        details.drawText("CARACTERÍSTICA", { x: margin, y: top, size: 7, font: bold, color: muted });
        details.drawText(horse ? "VALOR" : "DEP", { x: 315, y: top, size: 7, font: bold, color: muted });
        if (hasPrecision || hasPercentile) details.drawText(hasPrecision && hasPercentile ? "PREC. / TOP" : hasPercentile ? "TOP" : "PREC.", { x: 415, y: top, size: 7, font: bold, color: muted });
        top -= 19;
        for (const dep of visibleDeps) {
          if (top < 65) nextPage();
          details.drawText(printable(dep.label).slice(0, 50), { x: margin, y: top, size: 9, font: regular, color: ink });
          details.drawText(printable(dep.value).slice(0, 25), { x: 315, y: top, size: 9, font: bold, color: ink });
          const reference = [hasAnimalValue(dep.precision) ? dep.precision!.trim() : "", formatAnimalPercentile(dep.percentile)].filter(Boolean).join(" · ");
          if (reference) details.drawText(printable(reference).slice(0, 25), { x: 415, y: top, size: 8, font: regular, color: muted });
          details.drawLine({ start: { x: margin, y: top - 7 }, end: { x: pageWidth - margin, y: top - 7 }, thickness: .5, color: line });
          top -= 21;
        }
      }
      details.drawText(`Ficha online: ${animalUrl}`, { x: margin, y: 32, size: 8, font: regular, color: accent });
    }
    const bytes = Buffer.from(await pdf.save());
    return new Response(bytes, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="ficha-${slugify(animal.name)}-rp-${slugify(animal.rp)}.pdf"`, "Cache-Control": "public, max-age=60" } });
  } catch (error) {
    console.error("Could not create animal PDF", error);
    return new Response("No se pudo generar la ficha PDF.", { status: 500 });
  }
}
