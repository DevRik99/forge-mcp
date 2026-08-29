#!/usr/bin/env node
// Regla: las Entities (reglas de negocio empresariales) no importan ningún
// framework, ORM ni librería de UI/HTTP.
// Por qué: en cuanto el dominio importa un framework, dejó de poder probarse
// sin levantarlo — la razón de ser de aislar las reglas de negocio se pierde
// en el primer import.
//
// Uso: node check-domain-no-framework-imports.mjs [raiz-del-proyecto]

import path from "node:path";
import { ALIAS_CAPAS, resolverCarpetaCapa, listarArchivosFuente, extraerImports, leer } from "./_capas-comunes.mjs";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

const DENYLIST_FRAMEWORKS = [
  /^express$/,
  /^@nestjs\//,
  /^typeorm$/,
  /^@prisma\/client$/,
  /^prisma$/,
  /^sequelize$/,
  /^mongoose$/,
  /^knex$/,
  /^react$/,
  /^react-dom$/,
  /^vue$/,
  /^next$/,
  /^fastify$/,
  /^koa$/,
  /^axios$/,
];

const dominioDir = resolverCarpetaCapa(root, ALIAS_CAPAS.domain);
if (!dominioDir) {
  console.log(`OMITIDO: no se encontró carpeta de dominio (probadas: ${ALIAS_CAPAS.domain.join(", ")}) bajo src/ ni en la raíz.`);
  process.exit(0);
}

const violaciones = [];
for (const archivo of listarArchivosFuente(dominioDir)) {
  const contenido = leer(archivo);
  const imports = extraerImports(contenido);
  for (const imp of imports) {
    if (DENYLIST_FRAMEWORKS.some((patron) => patron.test(imp))) {
      violaciones.push({ archivo: path.relative(root, archivo), imp });
    }
  }
}

if (violaciones.length > 0) {
  console.error(`FAIL: imports de framework/ORM/UI detectados en la capa de dominio (${path.relative(root, dominioDir)}):`);
  for (const { archivo, imp } of violaciones) console.error(`  - ${archivo}: import "${imp}"`);
  console.error("Arreglo: mover ese import a la capa de infraestructura y exponer al dominio solo la interfaz que necesita.");
  process.exit(1);
}

console.log(`OK: ningún import de framework/ORM/UI en ${path.relative(root, dominioDir)}.`);
process.exit(0);
