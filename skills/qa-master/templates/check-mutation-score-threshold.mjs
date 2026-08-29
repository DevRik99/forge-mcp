#!/usr/bin/env node
// Regla: el score de mutación tiene un umbral de corte en CI
// (thresholds.break de Stryker).
// Por qué: una suite en verde con cobertura alta puede no detectar ningún
// cambio real de comportamiento — mutation testing es lo único que lo
// comprueba, y sin un umbral que corte, un score bajo se ignora igual.
//
// Uso: node check-mutation-score-threshold.mjs [raiz-del-proyecto]

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

const CANDIDATOS_CONFIG = ["stryker.conf.json", "stryker.config.json", "stryker.conf.js", "stryker.conf.mjs", ".stryker.conf.json"];
let configPath = CANDIDATOS_CONFIG.map((f) => path.join(root, f)).find(existsSync);
let contenido = "";

if (configPath) {
  contenido = readFileSync(configPath, "utf8");
} else {
  const packageJsonPath = path.join(root, "package.json");
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
      if (pkg.stryker) {
        configPath = packageJsonPath;
        contenido = JSON.stringify(pkg.stryker);
      }
    } catch {
      // se ignora: otro gate reporta package.json corrupto
    }
  }
}

if (!configPath) {
  console.log("OMITIDO: no se encontró configuración de Stryker (stryker.conf.{json,js,mjs} ni clave \"stryker\" en package.json).");
  process.exit(0);
}

const matchBreak = contenido.match(/["']?break["']?\s*:\s*(\d+(\.\d+)?)/);

if (!matchBreak) {
  console.error(`FAIL: ${path.relative(root, configPath)} configura Stryker pero no declara thresholds.break.`);
  console.error('Arreglo: agregar "thresholds": { "break": 60 } (o el umbral que corresponda) para que el pipeline corte si el score de mutación cae por debajo.');
  process.exit(1);
}

const umbral = Number(matchBreak[1]);
console.log(`OK: thresholds.break configurado en ${umbral} (${path.relative(root, configPath)}).`);
process.exit(0);
