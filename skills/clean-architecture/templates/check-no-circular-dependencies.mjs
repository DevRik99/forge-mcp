#!/usr/bin/env node
// Regla: el grafo de dependencias entre componentes es acíclico (ADP —
// Acyclic Dependencies Principle).
// Por qué: un ciclo de dependencias hace que un cambio en cualquier punto del
// ciclo se propague de forma impredecible al resto, e impide liberar un
// componente de forma independiente del otro.
//
// Este script NO reimplementa detección de ciclos (eso ya lo hace madge o
// dependency-cruiser mejor de lo que un script ad-hoc podría). Ejecuta la
// herramienta que el proyecto ya tenga configurada; si no tiene ninguna,
// reporta OMITIDO con la instrucción para instalarla — nunca finge un PASA.
//
// Uso: node check-no-circular-dependencies.mjs [raiz-del-proyecto]

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const packageJsonPath = path.join(root, "package.json");

function tieneDependencia(pkg, nombre) {
  return Boolean(pkg.dependencies?.[nombre] || pkg.devDependencies?.[nombre]);
}

let pkg = {};
if (existsSync(packageJsonPath)) {
  try {
    pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  } catch {
    console.error("FAIL: package.json existe pero no se pudo parsear.");
    process.exit(1);
  }
}

const srcDir = existsSync(path.join(root, "src")) ? "src" : ".";

if (tieneDependencia(pkg, "madge")) {
  try {
    execFileSync("npx", ["madge", "--circular", "--extensions", "ts,tsx,js,jsx", srcDir], { cwd: root, stdio: "inherit" });
    console.log("OK: madge no encontró dependencias circulares.");
    process.exit(0);
  } catch {
    console.error("FAIL: madge encontró dependencias circulares (ver salida arriba).");
    console.error("Arreglo: romper el ciclo extrayendo la parte compartida a un módulo del que ambos dependan, sin que ninguno dependa del otro.");
    process.exit(1);
  }
}

const CONFIG_DEPCRUISER = [".dependency-cruiser.js", ".dependency-cruiser.cjs", ".dependency-cruiser.json"].map((f) => path.join(root, f)).find(existsSync);

if (CONFIG_DEPCRUISER && tieneDependencia(pkg, "dependency-cruiser")) {
  try {
    execFileSync("npx", ["depcruise", "--config", CONFIG_DEPCRUISER, "--validate", srcDir], { cwd: root, stdio: "inherit" });
    console.log("OK: dependency-cruiser no reportó ciclos ni violaciones.");
    process.exit(0);
  } catch {
    console.error("FAIL: dependency-cruiser reportó violaciones (revisar si incluyen 'no-circular').");
    process.exit(1);
  }
}

console.log("OMITIDO: no se encontró madge ni dependency-cruiser configurados — no hay forma confiable de detectar ciclos sin ellos.");
console.log("Arreglo: `npm install --save-dev madge` y correr `npx madge --circular src` (o configurar dependency-cruiser con la regla 'no-circular').");
process.exit(0);
