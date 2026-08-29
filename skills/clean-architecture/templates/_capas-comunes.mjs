// Utilidades compartidas por los checks de clean-architecture.
// No es un script ejecutable: lo importan check-*.mjs de esta misma carpeta.
//
// Detecta las carpetas de capa por convención de nombre (case-insensitive),
// aceptando las variantes más comunes en proyectos reales. Si un proyecto usa
// nombres propios que no están en esta lista, los checks reportan OMITIDO en
// vez de arriesgar un falso FAIL — ver cada script para el detalle.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export const ALIAS_CAPAS = {
  domain: ["domain", "entities", "core"],
  application: ["application", "use-cases", "usecases", "use_cases"],
  infrastructure: ["infrastructure", "infra", "frameworks", "adapters", "interface-adapters", "interfaces"],
};

export function resolverCarpetaCapa(root, alias) {
  const candidatosDirectos = alias.map((nombre) => path.join(root, "src", nombre));
  const candidatosRaiz = alias.map((nombre) => path.join(root, nombre));
  for (const candidato of [...candidatosDirectos, ...candidatosRaiz]) {
    if (existsSync(candidato) && statSync(candidato).isDirectory()) return candidato;
  }
  return null;
}

export function listarArchivosFuente(dir, acc = []) {
  let entradas;
  try {
    entradas = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entrada of entradas) {
    if (entrada.name === "node_modules" || entrada.name.startsWith(".")) continue;
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      listarArchivosFuente(ruta, acc);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entrada.name) && !/\.(test|spec)\.[jt]sx?$/.test(entrada.name)) {
      acc.push(ruta);
    }
  }
  return acc;
}

export function extraerImports(contenido) {
  const imports = [];
  const patronesES = [/import\s+(?:[\s\S]*?)\s+from\s+["']([^"']+)["']/g, /import\s*\(\s*["']([^"']+)["']\s*\)/g];
  const patronCJS = /require\s*\(\s*["']([^"']+)["']\s*\)/g;
  for (const patron of [...patronesES, patronCJS]) {
    let coincidencia;
    while ((coincidencia = patron.exec(contenido)) !== null) {
      imports.push(coincidencia[1]);
    }
  }
  return imports;
}

export function leer(archivo) {
  try {
    return readFileSync(archivo, "utf8");
  } catch {
    return "";
  }
}
