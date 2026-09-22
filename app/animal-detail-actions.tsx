import "./animal-tools.css";

export function AnimalDetailActions({ id, section }: { id: number; section: "genetics" | "criollos" }) {
  return <div className="animalDetailActions" aria-label="Opciones de la ficha">
    <a href={`/api/animals/${id}/pdf`} download>↓ Descargar ficha PDF</a>
    <a href={`/${section === "criollos" ? "criollos" : "genetica"}#comparar-animales`}>Comparar animales ↗</a>
  </div>;
}
