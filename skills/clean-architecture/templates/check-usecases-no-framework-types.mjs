#!/usr/bin/env node
// Regla: los Use Cases reciben y devuelven DTOs/Request-Response models, nunca
// objetos del framework (Request/Response HTTP, entidades de ORM).
// Por qué: si un Use Case depende de un tipo del framework o del ORM, cambiar
// ese framework o ese ORM obliga a reescribir la lógica de aplicación en vez
// de sólo la capa de infraestructura que lo conecta.
//
// Uso: node check-usecases-no-framework-types.mjs [raiz-del-proyecto]

import path from "node:path";
import { ALIAS_CAPAS, resolverCarpetaCapa, listarArchivosFuente, extraerImports, leer } from "./_capas-comunes.mjs";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

const DENYLIST_TIPOS_FRAMEWORK = [
  /^express$/,
  /^@nestjs\/common$/,
  /^@nestjs\/core$/,
  /^typeorm$/,
  /^@prisma\/client$/,
  /^sequelize$/,
  /^mongoose$/,
  /^fastify$/,
  /^koa$/,
  /^http$/,
];

const aplicacionDir = resolverCarpetaCapa(root, ALIAS_CAPAS.application);
if (!aplicacionDir) {
  console.log(`OMITIDO: no se encontró carpeta de application/use-cases (probadas: ${ALIAS_CAPAS.application.join(", ")}) bajo src/ ni en la raíz.`);
  process.exit(0);
}

const violaciones = [];
for (const archivo of listarArchivosFuente(aplicacionDir)) {
  const contenido = leer(archivo);
  const imports = extraerImports(contenido);
  for (const imp of imports) {
    if (DENYLIST_TIPOS_FRAMEWORK.some((patron) => patron.test(imp))) {
      violaciones.push({ archivo: path.relative(root, archivo), imp });
    }
  }
  if (/\b(Request|Response)\s*[,)]|:\s*(Request|Response)\b/.test(contenido) && /from\s+["']express["']/.test(contenido)) {
    violaciones.push({ archivo: path.relative(root, archivo), imp: "Request/Response de express usados como tipo" });
  }
}

if (violaciones.length > 0) {
  console.error(`FAIL: tipos de framework/ORM detectados en la capa de aplicación (${path.relative(root, aplicacionDir)}):`);
  for (const { archivo, imp } of violaciones) console.error(`  - ${archivo}: ${imp}`);
  console.error("Arreglo: definir un DTO propio (request/response model) para el Use Case y traducir desde/hacia el tipo del framework en el controlador.");
  process.exit(1);
}

console.log(`OK: ningún tipo de framework/ORM detectado en ${path.relative(root, aplicacionDir)}.`);
process.exit(0);
