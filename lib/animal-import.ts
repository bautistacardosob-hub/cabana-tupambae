export type SpreadsheetCell = string | number | boolean | Date | null;

export type ImportedAnimalDraft = {
  sourceRow: number;
  name: string;
  type: string;
  rp: string;
  breed: string;
  birthDate: string;
  registration: string;
  weaningWeight: string;
  weaningWeightLabel: string;
  frame: string;
  pedigree: Array<{ relation: string; name: string; registration: null; sortOrder: number }>;
  deps: Array<{ label: string; value: string; precision: string | null; percentile: null; sortOrder: number }>;
  errors: string[];
};

const normalize = (value: unknown) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const text = (value: SpreadsheetCell | undefined) => {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) return formatDate(value);
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(value);
  return String(value).trim();
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(value);
}

function excelDate(value: SpreadsheetCell | undefined) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return formatDate(value);
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return formatDate(date);
  }
  return text(value);
}

function columnIndex(headers: string[], ...candidates: string[]) {
  const normalized = candidates.map(normalize);
  return headers.findIndex(header => normalized.includes(normalize(header)));
}

export function parseAnimalWorkbook(rows: SpreadsheetCell[][], options?: { breed?: string; defaultType?: string }) {
  const headerIndex = rows.findIndex(row => {
    const values = row.map(normalize);
    return (values.includes("rp") || values.includes("r p")) && values.includes("nombre");
  });
  if (headerIndex < 0) throw new Error("No encontramos una fila de encabezados con las columnas R.P. y Nombre.");

  const top = rows[headerIndex] ?? [];
  const sub = rows[headerIndex + 1] ?? [];
  let activeGroup = "";
  const groups = top.map((cell, index) => {
    const current = normalize(cell);
    if (current) activeGroup = current;
    return `${activeGroup}:${normalize(sub[index])}`;
  });
  const topHeaders = top.map(normalize);
  const findTop = (...names: string[]) => columnIndex(topHeaders, ...names);
  const depGroups = ["PN", "PD", "HL", "P18", "PA", "CE", "AOB", "Grasa", "MAR"];
  const depColumns = depGroups.flatMap(label => {
    const group = normalize(label);
    const valueIndex = groups.findIndex(key => key === `${group}:dep` || key === `${group}:`);
    const precisionIndex = groups.findIndex(key => key === `${group}:prec`);
    return valueIndex >= 0 ? [{ label, valueIndex, precisionIndex }] : [];
  });

  const indexes = {
    type: findTop("Destino", "Categoría"),
    weight: topHeaders.findIndex(header => header === "peso" || /^peso \d{1,2} \d{1,2}(?: \d{2,4})?$/.test(header)),
    lot: findTop("Lote"),
    rp: findTop("R.P.", "RP"),
    registration: findTop("H.B.U", "HBU", "Registro"),
    birthDate: findTop("F.Nac.", "Fecha de nacimiento", "Nacimiento"),
    name: findTop("Nombre", "Animal"),
    sire: findTop("Padre"),
    maternalGrandsire: findTop("Abuelo Materno"),
    damRp: findTop("R.P Madre", "RP Madre"),
  };
  const weightLabel = indexes.weight >= 0 ? text(top[indexes.weight]) : "Peso al destete";

  const parsed: ImportedAnimalDraft[] = [];
  const seen = new Set<string>();
  for (let rowIndex = headerIndex + 2; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const marker = normalize(row[0]);
    const rp = text(row[indexes.rp]);
    const name = text(row[indexes.name]);
    if (!rp && !name) continue;
    if (marker.startsWith("promedio") || marker.startsWith("percentil") || marker.startsWith("nota")) continue;
    const errors: string[] = [];
    if (!rp) errors.push("Falta RP");
    if (!name) errors.push("Falta nombre");
    if (rp && seen.has(rp)) errors.push("RP repetido dentro del archivo");
    if (rp) seen.add(rp);
    const sire = text(row[indexes.sire]);
    const maternalGrandsire = text(row[indexes.maternalGrandsire]);
    const damRp = text(row[indexes.damRp]);
    const pedigree = [
      sire ? { relation: "sire", name: sire, registration: null, sortOrder: 0 } : null,
      damRp ? { relation: "dam", name: `RP ${damRp}`, registration: null, sortOrder: 1 } : null,
      maternalGrandsire ? { relation: "maternal_grandsire", name: maternalGrandsire, registration: null, sortOrder: 4 } : null,
    ].filter((item): item is NonNullable<typeof item> => Boolean(item));
    const deps = depColumns.flatMap(({ label, valueIndex, precisionIndex }, sortOrder) => {
      const value = text(row[valueIndex]);
      if (!value) return [];
      const precision = precisionIndex >= 0 ? text(row[precisionIndex]) : "";
      return [{ label, value, precision: precision || null, percentile: null, sortOrder }];
    });
    parsed.push({
      sourceRow: rowIndex + 1,
      name,
      type: text(row[indexes.type]) || options?.defaultType || "Sin categoría",
      rp,
      breed: options?.breed?.trim() || "Hereford",
      birthDate: excelDate(row[indexes.birthDate]),
      registration: text(row[indexes.registration]),
      weaningWeight: text(row[indexes.weight]),
      weaningWeightLabel: weightLabel,
      frame: text(row[indexes.lot]),
      pedigree,
      deps,
      errors,
    });
  }
  if (!parsed.length) throw new Error("No encontramos animales debajo de los encabezados del archivo.");
  return { sheetHeaderRow: headerIndex + 1, animals: parsed, depLabels: depColumns.map(item => item.label) };
}
