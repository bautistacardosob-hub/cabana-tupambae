export function registrationDisplayLabel(label: string | null | undefined): string {
  if (label == null) return "HBU";
  return label.trim().toLocaleLowerCase("es") === "registro" ? "HBU" : label;
}
