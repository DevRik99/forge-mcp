#!/usr/bin/env node
// Regla: @nuxt/devtools deshabilitado en producción.
// Por qué: el panel de devtools expuesto en producción es CVE-2024-23657 —
// permite ejecutar código arbitrario en el servidor a través de su API interna
// si queda alcanzable fuera del entorno de desarrollo.
//
// Uso: node check-devtools-disabled-in-production.mjs [raiz-del-proyecto]

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const CANDIDATOS = ["nuxt.config.ts", "nuxt.config.js", "nuxt.config.mjs"];

const configPath = CANDIDATOS.map((f) => path.join(root, f)).find(existsSync);
if (!configPath) {
  console.log("OMITIDO: no se encontró nuxt.config.{ts,js,mjs} en la raíz del proyecto.");
  process.exit(0);
}

const contenido = readFileSync(configPath, "utf8");
const matchDevtools = contenido.match(/devtools\s*:\s*\{([^}]*)\}/);

if (!matchDevtools) {
  console.log("OK: nuxt.config no fuerza devtools habilitado (default de Nuxt: no se embebe en el build de producción).");
  process.exit(0);
}

const bloque = matchDevtools[1];
const matchEnabled = bloque.match(/enabled\s*:\s*([^,\n]+)/);
const valor = matchEnabled ? matchEnabled[1].trim() : null;

if (valor === "true") {
  console.error(`FAIL: devtools.enabled está forzado a "true" sin condición de entorno en ${path.relative(root, configPath)}.`);
  console.error('Arreglo: devtools: { enabled: process.env.NODE_ENV === "development" } (o remover la clave para usar el default).');
  process.exit(1);
}

console.log("OK: devtools no está forzado a true incondicionalmente.");
process.exit(0);
