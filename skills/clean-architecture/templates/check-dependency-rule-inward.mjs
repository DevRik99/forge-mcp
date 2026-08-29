#!/usr/bin/env node
// Regla: los source code dependencies siempre apuntan hacia adentro; un
// círculo interior nunca importa nombres de un círculo exterior
// (domain → application → infrastructure/frameworks, nunca al revés).
// Por qué: en cuanto el dominio depende de un detalle externo, ese detalle ya
// no se puede cambiar sin tocar la lógica de negocio — la inversión de
// dependencias es la que hace que la arquitectura sea "limpia".
//
// Si el proyecto ya tiene dependency-cruiser configurado, este script lo
// ejecuta a él (es la herramienta autoritativa: entiende alias de tsconfig,
// resuelve paths, etc.). Si no lo tiene, hace un chequeo liviano por texto
// —imports relativos que escapan hacia una capa exterior— y lo declara
// explícitamente como heurística.
//
// Uso: node check-dependency-rule-inward.mjs [raiz-del-proyecto]

import { existsSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ALIAS_CAPAS, resolverCarpetaCapa, listarArchivosFuente, extraerImports, leer } from "./_capas-comunes.mjs";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

const CONFIG_DEPCRUISER = [".dependency-cruiser.js", ".dependency-cruiser.cjs", ".dependency-cruiser.json", "dependency-cruiser.config.mjs"]
  .map((f) => path.join(root, f))
  .find(existsSync);

if (CONFIG_DEPCRUISER) {
  try {
    execFileSync("npx", ["depcruise", "--config", CONFIG_DEPCRUISER, "--validate", "src"], { cwd: root, stdio: "inherit" });
    console.log("OK: dependency-cruiser no reportó violaciones de la regla de dependencia.");
    process.exit(0);
  } catch (error) {
    console.error("FAIL: dependency-cruiser reportó violaciones de la regla de dependencia (ver salida arriba).");
    process.exit(1);
  }
}

console.log("AVISO: no se encontró configuración de dependency-cruiser; se aplica un chequeo heurístico por imports relativos (menos preciso, no resuelve alias de tsconfig).");

const dominioDir = resolverCarpetaCapa(root, ALIAS_CAPAS.domain);
const aplicacionDir = resolverCarpetaCapa(root, ALIAS_CAPAS.application);
const infraDir = resolverCarpetaCapa(root, ALIAS_CAPAS.infrastructure);

if (!dominioDir && !aplicacionDir) {
  console.log("OMITIDO: no se encontraron carpetas de domain/ ni application/ bajo src/ ni en la raíz — nada que verificar con esta convención.");
  process.exit(0);
}

function apuntaHaciaAfuera(archivo, dirCapa, dirsProhibidos) {
  const contenido = leer(archivo);
  const imports = extraerImports(contenido).filter((imp) => imp.startsWith("."));
  const violaciones = [];
  for (const imp of imports) {
    const resuelto = path.resolve(path.dirname(archivo), imp);
    for (const dirProhibido of dirsProhibidos) {
      if (dirProhibido && resuelto.startsWith(dirProhibido)) {
        violaciones.push({ archivo: path.relative(root, archivo), imp });
      }
    }
  }
  return violaciones;
}

const violaciones = [];
if (dominioDir) {
  for (const archivo of listarArchivosFuente(dominioDir)) {
    violaciones.push(...apuntaHaciaAfuera(archivo, dominioDir, [aplicacionDir, infraDir]));
  }
}
if (aplicacionDir) {
  for (const archivo of listarArchivosFuente(aplicacionDir)) {
    violaciones.push(...apuntaHaciaAfuera(archivo, aplicacionDir, [infraDir]));
  }
}

if (violaciones.length > 0) {
  console.error("FAIL: imports que apuntan hacia una capa exterior (dominio→aplicación/infra, o aplicación→infra):");
  for (const { archivo, imp } of violaciones) console.error(`  - ${archivo}: import "${imp}"`);
  console.error("Arreglo: invertir la dependencia — la capa interior declara una interfaz, la capa exterior la implementa.");
  console.error("Para un chequeo más preciso (con alias de tsconfig), configurar dependency-cruiser con reglas 'forbidden' entre capas.");
  process.exit(1);
}

console.log("OK: no se detectaron imports de una capa interior hacia una capa exterior (chequeo heurístico).");
process.exit(0);
