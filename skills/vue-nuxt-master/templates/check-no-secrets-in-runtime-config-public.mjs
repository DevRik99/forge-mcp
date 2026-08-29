#!/usr/bin/env node
// Regla: ningún secreto (DATABASE_URL, claves, tokens) expuesto bajo
// runtimeConfig.public en nuxt.config.
// Por qué: todo lo que cuelga de runtimeConfig.public se serializa al bundle
// de cliente y queda visible para cualquiera que abra las devtools del
// navegador — es la vía más directa de filtrar credenciales sin que nadie
// lo note, porque el servidor sigue funcionando igual.
//
// Uso: node check-no-secrets-in-runtime-config-public.mjs [raiz-del-proyecto]

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const CANDIDATOS = ["nuxt.config.ts", "nuxt.config.js", "nuxt.config.mjs"];
const PATRON_SECRETO = /(secret|token|password|passwd|api[_-]?key|private[_-]?key|credential|dsn|database[_-]?url|db[_-]?url|connection[_-]?string)/i;

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

const configPath = CANDIDATOS.map((f) => path.join(root, f)).find(existsSync);
if (!configPath) {
  console.log("OMITIDO: no se encontró nuxt.config.{ts,js,mjs} en la raíz del proyecto.");
  process.exit(0);
}

const contenido = readFileSync(configPath, "utf8");
const idxRuntimeConfig = contenido.search(/runtimeConfig\s*:/);
if (idxRuntimeConfig === -1) {
  console.log("OK: el proyecto no declara runtimeConfig (nada que exponer).");
  process.exit(0);
}

const bloqueRuntimeConfig = encontrarBloque(contenido, contenido.indexOf("{", idxRuntimeConfig));
if (!bloqueRuntimeConfig) {
  console.log("OMITIDO: no se pudo delimitar el bloque runtimeConfig (config no estándar); revisar a mano.");
  process.exit(0);
}

const idxPublic = bloqueRuntimeConfig.search(/\bpublic\s*:/);
if (idxPublic === -1) {
  console.log("OK: runtimeConfig no declara sección public.");
  process.exit(0);
}

const bloquePublic = encontrarBloque(bloqueRuntimeConfig, bloqueRuntimeConfig.indexOf("{", idxPublic));
if (!bloquePublic) {
  console.log("OMITIDO: no se pudo delimitar runtimeConfig.public (config no estándar); revisar a mano.");
  process.exit(0);
}

const lineasSospechosas = bloquePublic
  .split("\n")
  .filter((linea) => !linea.trim().startsWith("//"))
  .filter((linea) => {
    const clave = linea.split(":")[0]?.trim().replace(/['"]/g, "");
    return clave && PATRON_SECRETO.test(clave);
  });

if (lineasSospechosas.length > 0) {
  console.error(`FAIL: claves con patrón de secreto dentro de runtimeConfig.public en ${path.relative(root, configPath)}:`);
  for (const linea of lineasSospechosas) console.error(`  - ${linea.trim()}`);
  console.error("Arreglo: mover la clave a runtimeConfig (nivel raíz, privado) en vez de runtimeConfig.public.");
  process.exit(1);
}

console.log("OK: runtimeConfig.public no expone claves con patrón de secreto.");
process.exit(0);
