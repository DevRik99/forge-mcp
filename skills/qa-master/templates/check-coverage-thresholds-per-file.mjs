#!/usr/bin/env node
// Regla: cobertura configurada por archivo/glob (perFile), no sólo un umbral
// global agregado.
// Por qué: un umbral global se cumple aunque un archivo nuevo tenga 0%
// cobertura, mientras archivos viejos bien cubiertos compensan el promedio —
// el código nuevo del PR queda sin ningún test y nadie lo nota.
//
// Uso: node check-coverage-thresholds-per-file.mjs [raiz-del-proyecto]

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

const CANDIDATOS = ["vitest.config.ts", "vitest.config.js", "vitest.config.mjs", "vite.config.ts", "vite.config.js"];
const configPath = CANDIDATOS.map((f) => path.join(root, f)).find(existsSync);

if (!configPath) {
  console.log("OMITIDO: no se encontró vitest.config.{ts,js,mjs} ni vite.config.{ts,js} en la raíz del proyecto.");
  process.exit(0);
}

const contenido = readFileSync(configPath, "utf8");
const idxCoverage = contenido.search(/coverage\s*:\s*\{/);

if (idxCoverage === -1) {
  console.log(`OMITIDO: ${path.relative(root, configPath)} no declara bloque coverage — el proyecto puede no usar cobertura, o configurarla en otro archivo.`);
  process.exit(0);
}

function encontrarBloque(texto, indiceApertura) {
  let profundidad = 0;
  let inicio = -1;
  for (let i = indiceApertura; i < texto.length; i++) {
    if (texto[i] === "{") {
      if (profundidad === 0) inicio = i;
      profundidad++;
    } else if (texto[i] === "}") {
      profundidad--;
      if (profundidad === 0) return texto.slice(inicio, i + 1);
    }
  }
  return null;
}

const bloqueCoverage = encontrarBloque(contenido, contenido.indexOf("{", idxCoverage));
if (!bloqueCoverage) {
  console.log("OMITIDO: no se pudo delimitar el bloque coverage (config no estándar); revisar a mano.");
  process.exit(0);
}

const tienePerFile = /\bperFile\s*:\s*true/.test(bloqueCoverage);
const tieneThresholdsAnidados = /thresholds\s*:\s*\{[^}]*['"][^'"]*['"]\s*:\s*\{/.test(bloqueCoverage.replace(/\n/g, " "));

if (!tienePerFile && !tieneThresholdsAnidados) {
  console.error(`FAIL: coverage.thresholds en ${path.relative(root, configPath)} sólo declara un umbral global, sin perFile ni umbrales por glob.`);
  console.error("Arreglo: agregar `perFile: true` dentro de coverage.thresholds, o declarar umbrales anidados por ruta (ej. thresholds: { \"src/critico/**\": { statements: 90 } }).");
  process.exit(1);
}

console.log(`OK: coverage.thresholds en ${path.relative(root, configPath)} está configurado por archivo/glob.`);
process.exit(0);
