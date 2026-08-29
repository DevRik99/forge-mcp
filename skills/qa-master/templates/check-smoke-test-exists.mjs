#!/usr/bin/env node
// Regla: existe un smoke test que arranca el sistema real (no sólo pruebas
// unitarias en verde).
// Por qué: una suite de miles de tests unitarios en verde no dice nada sobre
// si la aplicación arranca — corren en un proceso aislado por diseño. El caso
// documentado: 1681 tests verdes mientras la aplicación estuvo 17 horas caída
// en producción, porque nada abría el proceso real.
//
// Heurística: busca archivos con "smoke" en el nombre y confirma que su
// contenido arranca un proceso real (listen/serve/spawn de la app) y llama a
// una ruta que no sea sólo la raíz "/". No ejecuta el smoke test — sólo
// verifica que exista y tenga la forma esperada.
//
// Uso: node check-smoke-test-exists.mjs [raiz-del-proyecto]

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const IGNORAR = new Set(["node_modules", ".git", "dist", ".output", ".nuxt", "coverage"]);
const PATRON_NOMBRE = /smoke.*\.(test|spec)\.[jt]sx?$/i;
const PATRON_ARRANQUE = /(\.listen\(|createServer\(|spawn\(|execa\(|app\.start\(|preview\(|\$fetch\()/;
const PATRON_RUTA_INTERNA = /(fetch|request|\$fetch|got)\s*\(\s*[`'"][^`'"]*\/[a-zA-Z0-9_-]+/;

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
    } else {
      acc.push(ruta);
    }
  }
  return acc;
}

const candidatos = listarArchivos(root).filter((archivo) => PATRON_NOMBRE.test(path.basename(archivo)));

if (candidatos.length === 0) {
  console.error("FAIL: no se encontró ningún archivo *smoke*.{test,spec}.{js,ts,jsx,tsx} en el proyecto.");
  console.error("Arreglo: crear un smoke test que arranque el proceso real (server/app) y compruebe que una ruta representativa responde, no sólo la raíz.");
  process.exit(1);
}

const conArranqueYRuta = candidatos.filter((archivo) => {
  const contenido = readFileSync(archivo, "utf8");
  return PATRON_ARRANQUE.test(contenido) && PATRON_RUTA_INTERNA.test(contenido);
});

if (conArranqueYRuta.length === 0) {
  console.error("FAIL: se encontraron archivos de smoke test, pero ninguno parece arrancar el proceso real ni golpear una ruta interna representativa:");
  for (const archivo of candidatos) console.error(`  - ${path.relative(root, archivo)}`);
  console.error("Arreglo: el smoke test debe levantar el servidor/app real (listen/spawn/preview) y hacer al menos un request a una ruta distinta de \"/\".");
  process.exit(1);
}

console.log(`OK: smoke test encontrado (${conArranqueYRuta.map((a) => path.relative(root, a)).join(", ")}).`);
process.exit(0);
