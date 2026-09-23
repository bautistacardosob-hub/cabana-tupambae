"use client";

import { useEffect, useMemo, useState } from "react";
import { readAnimalImagePresentation } from "../lib/animal-image";
import { registrationDisplayLabel } from "../lib/animal-labels";
import "./animal-tools.css";

type Animal = {
  id: number; name: string; rp: string; type: string; breed: string; catalogSection: string;
  image: string; sold: boolean; registration?: string | null; birthDate?: string | null;
  coat?: string | null; birthWeight?: string | null; weaningWeight?: string | null;
  scrotalCircumference?: string | null; frame?: string | null;
  rpLabel?: string | null; birthDateLabel?: string | null; coatLabel?: string | null;
  registrationLabel?: string | null; birthWeightLabel?: string | null;
  weaningWeightLabel?: string | null; scrotalCircumferenceLabel?: string | null;
  frameLabel?: string | null; deps?: Array<{ label: string; value: string }>;
};

export function AnimalCompare({ section }: { section: "genetics" | "criollos" }) {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/animals", { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("No pudimos cargar los animales.");
      return response.json();
    }).then(data => setAnimals((data.animals || []).filter((animal: Animal) => animal.catalogSection === section)))
      .catch(cause => { if (cause.name !== "AbortError") setError("No pudimos cargar los animales para comparar."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [section]);
  const chosen = useMemo(() => selected.map(id => animals.find(animal => animal.id === id)).filter((animal): animal is Animal => Boolean(animal)), [animals, selected]);
  const baseFields: Array<[string, keyof Animal, (keyof Animal)?]> = [
    ["RP", "rp", "rpLabel"], ["Tipo", "type"], ["Raza", "breed"],
    ["Nacimiento", "birthDate", "birthDateLabel"], ["Pelaje", "coat", "coatLabel"],
    ["HBU", "registration", "registrationLabel"], ["Peso al nacer / Sexo", "birthWeight", "birthWeightLabel"],
    ["Peso al destete / Categoría", "weaningWeight", "weaningWeightLabel"],
    ["Circ. escrotal / Marcha", "scrotalCircumference", "scrotalCircumferenceLabel"], ["Frame / Estado", "frame", "frameLabel"],
  ];
  const depLabels = [...new Set(chosen.flatMap(animal => (animal.deps || []).map(dep => dep.label)))];
  const route = section === "criollos" ? "criollos" : "genetica";
  if (!loading && animals.length < 2) return null;
  const toggle = (id: number) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : current.length < 3 ? [...current, id] : current);
  return <section className="animalCompare" id="comparar-animales" aria-label="Comparar animales">
    <div className="animalCompareHeading"><div><span>COMPARACIÓN</span><h2>Compará ejemplares.</h2><p>Elegí dos o tres animales para ver sus datos lado a lado.</p></div><span className="animalCompareCount">{selected.length} / 3 seleccionados</span></div>
    {error ? <p role="alert">{error}</p> : <>
      <div className="animalComparePicker">{animals.map(animal => <label key={animal.id} className={selected.includes(animal.id) ? "selected" : ""}>
        <input type="checkbox" checked={selected.includes(animal.id)} disabled={!selected.includes(animal.id) && selected.length === 3} onChange={() => toggle(animal.id)}/>
        <span>{animal.name}<small>RP {animal.rp}{animal.sold ? " · Vendido" : ""}</small></span>
      </label>)}</div>
      <button className="animalCompareButton" type="button" disabled={selected.length < 2} onClick={() => setOpen(true)}>Comparar seleccionados ↗</button>
    </>}
    {open && <div className="animalCompareBackdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="animalCompareDialog" role="dialog" aria-modal="true" aria-labelledby="animal-compare-title">
        <header><div><span>COMPARACIÓN</span><h2 id="animal-compare-title">Animales lado a lado</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Cerrar comparación">×</button></header>
        <div className="animalCompareTableWrap"><table><thead><tr><th scope="col">Dato</th>{chosen.map(animal => <th scope="col" key={animal.id}><div className="animalComparePhoto" style={{backgroundImage:`url(${readAnimalImagePresentation(animal.image).source})`}}/><strong>{animal.name}</strong><small>{animal.sold ? "Vendido" : "Disponible"}</small><a href={`/${route}/${animal.id}`}>Ver ficha ↗</a></th>)}</tr></thead><tbody>
          {baseFields.map(([fallback, key, labelKey]) => chosen.some(animal => animal[key]) && <tr key={key}><th scope="row">{key === "registration" ? registrationDisplayLabel(chosen.find(animal => animal.registrationLabel)?.registrationLabel) : (labelKey && chosen.find(animal => animal[labelKey])?.[labelKey] as string) || fallback}</th>{chosen.map(animal => <td key={animal.id}>{String(animal[key] || "—")}</td>)}</tr>)}
          {depLabels.map(label => <tr key={label}><th scope="row">{label}</th>{chosen.map(animal => <td key={animal.id}>{animal.deps?.find(dep => dep.label === label)?.value || "—"}</td>)}</tr>)}
        </tbody></table></div>
      </div>
    </div>}
  </section>;
}
