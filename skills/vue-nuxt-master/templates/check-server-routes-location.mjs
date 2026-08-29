#!/usr/bin/env node
// Regla: las server routes viven en server/ (típicamente server/api/), nunca
// mezcladas con pages/ ni con componentes de cliente.
// Por qué: un defineEventHandler fuera de server/ no lo reconoce el motor de
// rutas server-side de Nitro (no se sirve como endpoint), y si el archivo
// termina en el bundle de cliente expone lógica y dependencias que debían
// quedar exclusivamente en el servidor.
//
// Uso: node check-server-routes-location.mjs [raiz-del-proyecto]

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const IGNORAR = new Set(["node_modules", ".nuxt", ".output", "dist", ".git", ".output"]);
const EXTENSIONES = /\.(ts|js|mjs|cjs)$/;
const RUTA_SERVIDOR = `${path.sep}server${path.sep}`;

function listarArchivos(dir, acc = []) {
  let entradas;
  try {
    entradas = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entrada of entradas) {
    if (IGNORAR.has(entrada.name)) continue;
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      listarArchivos(ruta, acc);
    } else if (EXTENSIONES.test(entrada.name)) {
      acc.push(ruta);
    }
  }
  return acc;
}

const archivos = listarArchivos(root);
const violaciones = [];

for (const archivo of archivos) {
  const rutaNormalizada = `${path.sep}${path.relative(root, archivo)}`;
  if (rutaNormalizada.startsWith(RUTA_SERVIDOR) || rutaNormalizada.includes(RUTA_SERVIDOR)) continue;

  let contenido;
  try {
    contenido = readFileSync(archivo, "utf8");
  } catch {
    continue;
  }
  if (/\bdefineEventHandler\s*\(/.test(contenido)) {
    violaciones.push(path.relative(root, archivo));
  }
}

if (violaciones.length > 0) {
  console.error("FAIL: defineEventHandler() usado fuera de server/:");
  for (const archivo of violaciones) console.error(`  - ${archivo}`);
  console.error("Arreglo: mover el handler a server/api/ (o el subdirectorio server/ que corresponda).");
  process.exit(1);
}

console.log("OK: ningún defineEventHandler() fuera de server/.");
process.exit(0);
