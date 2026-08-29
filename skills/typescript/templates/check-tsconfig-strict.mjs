#!/usr/bin/env node
// Regla: strict: true obligatorio en tsconfig.json.
// Por qué: sin strict, TypeScript permite null/undefined implícitos y tipado
// débil sin avisar — el chequeo de tipos existe en el papel pero no atrapa la
// clase de bug más común (acceder a algo que puede no estar).
//
// Uso: node check-tsconfig-strict.mjs [raiz-del-proyecto]

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const tsconfigPath = path.join(root, "tsconfig.json");

if (!existsSync(tsconfigPath)) {
  console.log("OMITIDO: no existe tsconfig.json en la raíz del proyecto.");
  process.exit(0);
}

function parseJsonc(texto) {
  // tsconfig.json admite comentarios; se despojan antes de JSON.parse.
  const sinComentariosBloque = texto.replace(/\/\*[\s\S]*?\*\//g, "");
  const sinComentariosLinea = sinComentariosBloque.replace(/(^|[^:])\/\/.*$/gm, "$1");
  const sinComasFinales = sinComentariosLinea.replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(sinComasFinales);
}

let tsconfig;
try {
  tsconfig = parseJsonc(readFileSync(tsconfigPath, "utf8"));
} catch (error) {
  console.error(`FAIL: no se pudo parsear tsconfig.json (${error.message}).`);
  process.exit(1);
}

function resolverStrict(config, dirBase, profundidad = 0) {
  if (profundidad > 10) return undefined;
  const strict = config.compilerOptions?.strict;
  if (strict !== undefined) return strict;
  if (config.extends) {
    const extendsList = Array.isArray(config.extends) ? config.extends : [config.extends];
    for (const relPath of extendsList) {
      if (!relPath.startsWith(".")) continue; // paquete de npm: no se resuelve acá
      const extendedPath = path.resolve(dirBase, relPath.endsWith(".json") ? relPath : `${relPath}.json`);
      if (!existsSync(extendedPath)) continue;
      try {
        const extendedConfig = parseJsonc(readFileSync(extendedPath, "utf8"));
        const resultado = resolverStrict(extendedConfig, path.dirname(extendedPath), profundidad + 1);
        if (resultado !== undefined) return resultado;
      } catch {
        continue;
      }
    }
  }
  return undefined;
}

const strict = resolverStrict(tsconfig, root);

if (strict !== true) {
  console.error(`FAIL: compilerOptions.strict no es true en tsconfig.json (valor efectivo: ${JSON.stringify(strict)}).`);
  console.error('Arreglo: agregar "strict": true en compilerOptions (directo o en el tsconfig base que se extiende).');
  process.exit(1);
}

console.log("OK: compilerOptions.strict es true.");
process.exit(0);
