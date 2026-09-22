"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnimalRecord } from "./page";
import { readAnimalImagePresentation } from "../lib/animal-image";
import { optimizedImageUrl } from "../lib/image-url";
import "./animal-catalog.css";

type CatalogProps = {
  animals: AnimalRecord[];
  comparePool?: AnimalRecord[];
  section: "genetics" | "criollos";
  onOpen: (animal: AnimalRecord) => void;
  indexOffset?: number;
};

function imageStyle(animal: AnimalRecord) {
  const image = readAnimalImagePresentation(animal.image);
  return {
    backgroundImage: `url(${optimizedImageUrl(image.source, 900)})`,
    backgroundPosition: `${image.x}% ${image.y}%`,
    backgroundSize: image.fit,
  };
}

function cardFacts(animal: AnimalRecord, horse: boolean) {
  const priorities = ["PD", "P18", "AOB"];
  const genetic = horse ? [] : (animal.deps || []).filter(item => item.label && item.value).toSorted((a, b) => {
    const rank = (label: string) => { const index = priorities.findIndex(key => new RegExp(`\\b${key}\\b`, "i").test(label)); return index < 0 ? priorities.length : index; };
    return rank(a.label) - rank(b.label);
  }).map(item => [`DEP ${item.label}`, item.value]);
  const ordinary = horse
    ? [[animal.coatLabel || "Pelaje", animal.coat], [animal.birthDateLabel || "Nacimiento", animal.birthDate], [animal.registrationLabel || "Registro", animal.registration]]
    : [[animal.weaningWeightLabel || "Peso al destete", animal.weaningWeight], [animal.birthWeightLabel || "Peso al nacer", animal.birthWeight], [animal.scrotalCircumferenceLabel || "Circ. escrotal", animal.scrotalCircumference]];
  return [...genetic, ...ordinary].filter((item): item is [string, string] => Boolean(item[0] && item[1])).slice(0, 3);
}

export function AnimalCatalog({ animals, comparePool = animals, section, onOpen, indexOffset = 0 }: CatalogProps) {
  const [selected, setSelected] = useState<number[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const horse = section === "criollos";
  const chosen = useMemo(() => selected.map(id => comparePool.find(animal => animal.id === id)).filter((animal): animal is AnimalRecord => Boolean(animal)), [comparePool, selected]);
  const customLabels = { birthDate: "birthDateLabel", coat: "coatLabel", registration: "registrationLabel", birthWeight: "birthWeightLabel", weaningWeight: "weaningWeightLabel", scrotalCircumference: "scrotalCircumferenceLabel", frame: "frameLabel" } as const;
  const comparisonLabel = (key: string, fallback: string) => {
    const labelKey = customLabels[key as keyof typeof customLabels];
    return labelKey ? chosen.find(animal => animal[labelKey])?.[labelKey] || fallback : fallback;
  };
  const activeIds = chosen.map(animal => animal.id);
  const depLabels = [...new Set(chosen.flatMap(animal => (animal.deps || []).map(dep => dep.label)))];
  const toggle = (id: number) => setSelected(current => {
    const present = current.filter(value => comparePool.some(animal => animal.id === value));
    return present.includes(id) ? present.filter(value => value !== id) : present.length < 3 ? [...present, id] : present;
  });

  useEffect(() => {
    if (!dialogOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setDialogOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [dialogOpen]);

  return <div className="catalogCardsWrap" id="comparar-animales">
    <section className="catalogCardGrid" aria-label={horse ? "Catálogo de Criollos" : "Catálogo de animales"}>
      {animals.map((animal, index) => {
        const picked = animal.id !== undefined && activeIds.includes(animal.id);
        const sire = animal.pedigree?.find(member => member.relation === "sire")?.name;
        const facts = cardFacts(animal, horse);
        return <article className={`catalogAnimalCard${picked ? " isSelected" : ""}`} key={animal.id ?? animal.name}>
          <div className="catalogAnimalPhoto" style={imageStyle(animal)}>
            <button type="button" className="catalogPhotoLink" onClick={() => onOpen(animal)} aria-label={`Ver ficha de ${animal.name}`} />
            <span className={`catalogStatus${animal.sold ? " sold" : ""}`}>{animal.sold ? "Vendido" : "Disponible"}</span>
            <span className="catalogCardIndex">{String(indexOffset + index + 1).padStart(2, "0")}</span>
            {animal.media?.some(item => item.kind === "video") && <span className="catalogVideoBadge">Video</span>}
          </div>
          <div className="catalogAnimalBody">
            <div className="catalogAnimalMeta"><span>{animal.breed || animal.type}</span><span>RP {animal.rp}</span></div>
            <h2>{animal.name}</h2>
            <p className="catalogAnimalType">{animal.type}</p>
            {sire && <p className="catalogAnimalSire"><small>Padre</small>{sire}</p>}
            {facts.length > 0 && <div className="catalogAnimalFacts">{facts.map(([label, value]) => <div key={label}><small title={label}>{label}</small><strong>{value}</strong></div>)}</div>}
            <div className="catalogAnimalActions"><button type="button" onClick={() => onOpen(animal)}>Ver ficha ↗</button><button type="button" className={picked ? "selected" : ""} disabled={animal.id === undefined || (!picked && activeIds.length >= 3)} onClick={() => animal.id !== undefined && toggle(animal.id)} aria-pressed={picked}>{picked ? "✓ Seleccionado" : "Comparar"}</button></div>
          </div>
        </article>;
      })}
    </section>

    {chosen.length > 0 && <div className="catalogCompareTray" role="status"><div><strong>{chosen.length} de 3 para comparar</strong><span>{chosen.map(animal => animal.name).join(" · ")}</span></div><button type="button" className="catalogClearCompare" onClick={() => setSelected([])}>Limpiar</button><button type="button" className="catalogOpenCompare" disabled={chosen.length < 2} onClick={() => setDialogOpen(true)}>Comparar seleccionados ↗</button></div>}

    {dialogOpen && <div className="catalogCompareBackdrop" onMouseDown={event => { if (event.target === event.currentTarget) setDialogOpen(false); }}>
      <div className="catalogCompareDialog" role="dialog" aria-modal="true" aria-labelledby="catalog-compare-title">
        <header><div><span>COMPARACIÓN</span><h2 id="catalog-compare-title">Animales lado a lado</h2></div><button type="button" onClick={() => setDialogOpen(false)} aria-label="Cerrar comparación">×</button></header>
        <div className="catalogCompareTableWrap"><table><thead><tr><th scope="col">Dato</th>{chosen.map(animal => <th scope="col" key={animal.id}><div className="catalogComparePhoto" style={imageStyle(animal)} /><strong>{animal.name}</strong><small>RP {animal.rp} · {animal.sold ? "Vendido" : "Disponible"}</small><button type="button" onClick={() => onOpen(animal)}>Ver ficha ↗</button></th>)}</tr></thead><tbody>
          {([ ["Tipo", "type"], ["Raza", "breed"], ["Nacimiento", "birthDate"], ["Pelaje", "coat"], ["Registro", "registration"], [horse ? "Sexo" : "Peso al nacer", "birthWeight"], [horse ? "Categoría" : "Peso al destete", "weaningWeight"], [horse ? "Marcha" : "Circ. escrotal", "scrotalCircumference"], ["Frame", "frame"] ] as const).filter(([, key]) => chosen.some(animal => animal[key])).map(([label, key]) => <tr key={key}><th scope="row">{comparisonLabel(key, label)}</th>{chosen.map(animal => <td key={animal.id}>{animal[key] || "—"}</td>)}</tr>)}
          {depLabels.map(label => <tr key={label}><th scope="row">{label}</th>{chosen.map(animal => <td key={animal.id}>{animal.deps?.find(dep => dep.label === label)?.value || "—"}</td>)}</tr>)}
        </tbody></table></div>
      </div>
    </div>}
  </div>;
}
