#!/usr/bin/env node
// Regla: el comando de verificación del proyecto incluye el schema-check de
// .ai/feature_list.json (rechaza más de una feature in_progress, o un status
// fuera del enum válido).
// Por qué: sin este check corriendo en el comando de verificación, el
// catálogo puede quedar incoherente durante semanas y nadie se entera porque
// nada lo mira.
//
// Este script hace dos cosas: (1) valida el catálogo si existe, igual que
// scripts/check-feature-list.mjs de @rules/feature-list.md, y (2) confirma
// que el comando de verificación del proyecto lo invoca.
//
// Uso: node check-feature-list-schema-check-wired.mjs [raiz-del-proyecto]

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const catalogPath = path.join(root, ".ai", "feature_list.json");

if (!existsSync(catalogPath)) {
  console.log("OMITIDO: no existe .ai/feature_list.json — el proyecto no usa este catálogo.");
  process.exit(0);
}

let catalog;
try {
  catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
} catch (error) {
  console.error(`FAIL: .ai/feature_list.json existe pero no se pudo parsear (${error.message}).`);
  process.exit(1);
}

const validStatus = catalog.rules?.valid_status ?? ["pending", "in_progress", "done", "blocked"];
const features = catalog.features ?? [];
const inProgress = features.filter((f) => f.status === "in_progress");
const invalidStatus = features.filter((f) => !validStatus.includes(f.status));

if (inProgress.length > 1) {
  console.error(`FAIL: ${inProgress.length} features en in_progress a la vez (máx 1): ${inProgress.map((f) => f.name).join(", ")}.`);
  process.exit(1);
}
if (invalidStatus.length > 0) {
  console.error(`FAIL: status inválido en: ${invalidStatus.map((f) => f.name).join(", ")}.`);
  process.exit(1);
}

const packageJsonPath = path.join(root, "package.json");
let comandoVerify = null;
if (existsSync(packageJsonPath)) {
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    comandoVerify = pkg.scripts?.verify ?? null;
  } catch {
    // se ignora: otro gate reporta package.json corrupto
  }
}

if (!comandoVerify) {
  console.error("FAIL: el catálogo es coherente, pero package.json no declara un script \"verify\" que lo invoque.");
  console.error("Arreglo: agregar un script \"verify\" en package.json que incluya `node .ai/scripts/check-feature-list.mjs` (o la ruta donde viva ese check).");
  process.exit(1);
}

if (!/feature[-_]?list/i.test(comandoVerify)) {
  console.error(`FAIL: el script "verify" existe (${comandoVerify}) pero no parece invocar el schema-check del catálogo.`);
  console.error("Arreglo: agregar la llamada al script de schema-check dentro de \"verify\" (buscar el patrón *feature*list* en el comando).");
  process.exit(1);
}

console.log("OK: catálogo coherente y el comando \"verify\" lo incluye.");
process.exit(0);
