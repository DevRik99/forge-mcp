#!/usr/bin/env node
// Regla: todo input de servidor se valida con Zod (getValidatedRouterParams /
// getValidatedQuery / readValidatedBody); nunca confiar en readBody crudo.
// Por qué: un input de servidor sin validar llega directo a la lógica de
// negocio y a la capa de datos — es la puerta de entrada más común para datos
// malformados o maliciosos.
//
// ADVERTENCIA (heredada de REGLAS-DURAS.md): esta comprobación es una
// HEURÍSTICA por archivo, no un análisis de flujo de datos. Marca cualquier
// archivo que use readBody() sin ver también alguna de las funciones
// validadas EN EL MISMO ARCHIVO. Puede dar falsos positivos si la validación
// vive en un helper importado — todo hallazgo se revisa a mano antes de
// actuar.
//
// Uso: node check-server-input-validation.mjs [raiz-del-proyecto]

import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const serverDir = path.join(root, "server");
const EXTENSIONES = /\.(ts|js|mjs|cjs)$/;
const FUNCIONES_VALIDADAS = /(getValidatedRouterParams|getValidatedQuery|readValidatedBody)\s*\(/;
const READ_BODY_CRUDO = /\breadBody\s*\(/;

if (!existsSync(serverDir)) {
  console.log("OMITIDO: no existe carpeta server/ en la raíz del proyecto.");
  process.exit(0);
}

function listarArchivos(dir, acc = []) {
  let entradas;
  try {
    entradas = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entrada of entradas) {
    if (entrada.name === "node_modules") continue;
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      listarArchivos(ruta, acc);
    } else if (EXTENSIONES.test(entrada.name)) {
      acc.push(ruta);
    }
  }
  return acc;
}

const hallazgos = [];
for (const archivo of listarArchivos(serverDir)) {
  const contenido = readFileSync(archivo, "utf8");
  if (READ_BODY_CRUDO.test(contenido) && !FUNCIONES_VALIDADAS.test(contenido)) {
    hallazgos.push(path.relative(root, archivo));
  }
}

if (hallazgos.length > 0) {
  console.error("FAIL (heurística, revisar cada hallazgo antes de actuar): readBody() sin validación visible en el mismo archivo:");
  for (const archivo of hallazgos) console.error(`  - ${archivo}`);
  console.error("Arreglo: reemplazar readBody() por readValidatedBody(event, schema.parse) (o getValidatedQuery/getValidatedRouterParams según el caso).");
  console.error("Falso positivo posible: si la validación vive en un helper importado, descartar el hallazgo a mano.");
  process.exit(1);
}

console.log("OK: no se detectó readBody() crudo sin validación visible en el mismo archivo.");
process.exit(0);
