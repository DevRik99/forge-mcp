#!/usr/bin/env node
// Regla: CSP y cabeceras de seguridad (X-Content-Type-Options, X-Frame-Options,
// Strict-Transport-Security) configuradas en producción.
// Por qué: sin estas cabeceras el navegador no tiene ninguna defensa extra
// contra XSS reflejado, clickjacking o MIME sniffing — son la última capa
// cuando algo ya se coló por otro lado.
//
// Agnóstico de framework: busca las cabeceras en los puntos de configuración
// más comunes (Nuxt, Next, Express/helmet, Vercel, Netlify). Si el proyecto
// usa un mecanismo distinto, este check reporta OMITIDO en vez de un falso FAIL.
//
// Uso: node check-security-headers-configured.mjs [raiz-del-proyecto]

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const CABECERAS_REQUERIDAS = [
  { nombre: "X-Content-Type-Options", patron: /x-content-type-options/i },
  { nombre: "X-Frame-Options", patron: /(x-frame-options|frame-ancestors)/i },
  { nombre: "Strict-Transport-Security", patron: /strict-transport-security/i },
];

const ARCHIVOS_A_REVISAR = [
  "nuxt.config.ts",
  "nuxt.config.js",
  "nuxt.config.mjs",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "vercel.json",
  "netlify.toml",
  "server.ts",
  "server.js",
];

function leer(archivo) {
  try {
    return readFileSync(archivo, "utf8");
  } catch {
    return "";
  }
}

let contenidoTotal = "";
const archivosEncontrados = [];
for (const nombre of ARCHIVOS_A_REVISAR) {
  const ruta = path.join(root, nombre);
  if (existsSync(ruta)) {
    archivosEncontrados.push(nombre);
    contenidoTotal += leer(ruta);
  }
}

const packageJsonPath = path.join(root, "package.json");
let usaHelmet = false;
if (existsSync(packageJsonPath)) {
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    usaHelmet = Boolean(pkg.dependencies?.helmet || pkg.devDependencies?.helmet);
  } catch {
    // se ignora: otro gate reporta package.json corrupto
  }
}

if (archivosEncontrados.length === 0 && !usaHelmet) {
  console.log("OMITIDO: no se encontró ningún archivo de configuración conocido ni la dependencia helmet — revisar a mano dónde este proyecto define sus cabeceras HTTP.");
  process.exit(0);
}

if (usaHelmet) {
  console.log("OK: el proyecto declara la dependencia helmet (aplica el set estándar de cabeceras de seguridad, incluida HSTS y X-Content-Type-Options).");
  process.exit(0);
}

const faltantes = CABECERAS_REQUERIDAS.filter(({ patron }) => !patron.test(contenidoTotal));

if (faltantes.length > 0) {
  console.error(`FAIL: faltan cabeceras de seguridad en la configuración revisada (${archivosEncontrados.join(", ")}):`);
  for (const { nombre } of faltantes) console.error(`  - ${nombre}`);
  console.error("Arreglo: declarar las cabeceras faltantes en el bloque de headers del framework (ej. nitro.routeRules en Nuxt, headers() en next.config.js, o instalar helmet en Express).");
  process.exit(1);
}

console.log(`OK: las tres cabeceras mínimas están presentes en ${archivosEncontrados.join(", ")}.`);
process.exit(0);
