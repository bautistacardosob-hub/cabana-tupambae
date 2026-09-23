import assert from "node:assert/strict";
import test from "node:test";
import { registrationDisplayLabel } from "../lib/animal-labels.ts";
import { parseAnimalWorkbook } from "../lib/animal-import.ts";

test("legacy Registro labels display as HBU without changing custom labels", () => {
  assert.equal(registrationDisplayLabel("Registro"), "HBU");
  assert.equal(registrationDisplayLabel(null), "HBU");
  assert.equal(registrationDisplayLabel("Stud Book"), "Stud Book");
  assert.equal(registrationDisplayLabel(""), "");
});

test("the weighing date comes from the Excel heading", () => {
  const result = parseAnimalWorkbook([
    ["Nombre", "R.P.", "Peso 21/9/2027"],
    [null, null, null],
    ["Animal de prueba", "4828", "594 kg"],
  ]);
  assert.equal(result.animals[0].weaningWeight, "594 kg");
  assert.equal(result.animals[0].weaningWeightLabel, "Peso 21/9/2027");
});
