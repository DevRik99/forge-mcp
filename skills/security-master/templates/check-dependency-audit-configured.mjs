#!/usr/bin/env node
// Regla: dependencias con vulnerabilidades conocidas bloquean el build
// (npm audit --audit-level=high / Dependabot / Snyk en CI).
// Por qué: es A03 del OWASP Top 10 (cadena de suministro) — una dependencia
// vulnerable entra al proyecto sin que nadie escriba una línea de código
// insegura, y sin auditoría automática nadie se entera hasta el incidente.
//
// Este script NO reimplementa el escaneo de vulnerabilidades. Verifica que
// exista AL MENOS UNO de los tres mecanismos configurado.
//
// Uso: node check-dependency-audit-configured.mjs [raiz-del-proyecto]

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

function leer(archivo) {
  try {
    return readFileSync(archivo, "utf8");
  } catch {
    return "";
  }
}

const dependabotOk = existsSync(path.join(root, ".github", "dependabot.yml")) || existsSync(path.join(root, ".github", "dependabot.yaml"));
const snykOk = existsSync(path.join(root, ".snyk"));

let contenidoCI = "";
const workflowsDir = path.join(root, ".github", "workflows");
if (existsSync(workflowsDir)) {
  for (const archivo of readdirSync(workflowsDir).filter((f) => /\.ya?ml$/.test(f))) {
    contenidoCI += leer(path.join(workflowsDir, archivo));
  }
}
contenidoCI += leer(path.join(root, ".gitlab-ci.yml"));

const auditEnCI = /npm\s+audit(\s+--audit-level=(high|critical))?/i.test(contenidoCI) || /yarn\s+audit/i.test(contenidoCI) || /pnpm\s+audit/i.test(contenidoCI);
const snykEnCI = /snyk/i.test(contenidoCI);

const packageJsonPath = path.join(root, "package.json");
let auditEnScripts = false;
if (existsSync(packageJsonPath)) {
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    auditEnScripts = Object.values(pkg.scripts ?? {}).some((script) => /audit/i.test(script));
  } catch {
    // package.json corrupto: se ignora acá, otro gate lo reporta.
  }
}

const mecanismos = { dependabot: dependabotOk, snyk: snykOk || snykEnCI, npmAuditEnCI: auditEnCI };
const algunoActivo = Object.values(mecanismos).some(Boolean);

if (!algunoActivo) {
  console.error("FAIL: ningún mecanismo de auditoría de dependencias configurado (Dependabot, Snyk, ni `audit` en CI).");
  console.error(`  Dependabot (.github/dependabot.yml): ${dependabotOk ? "sí" : "no"}`);
  console.error(`  Snyk (.snyk o referencia en CI): ${mecanismos.snyk ? "sí" : "no"}`);
  console.error(`  npm/yarn/pnpm audit en CI: ${auditEnCI ? "sí" : "no"}`);
  console.error("Arreglo: habilitar Dependabot en el repo, o agregar `npm audit --audit-level=high` (falla el step si hay vulnerabilidades) a un workflow de CI.");
  process.exit(1);
}

if (auditEnScripts && !auditEnCI) {
  console.log("SUGERENCIA: hay un script `audit` en package.json pero no se lo ve invocado en CI — corre localmente nada más, así que depende de que alguien se acuerde.");
}

console.log(`OK: auditoría de dependencias configurada (${Object.entries(mecanismos).filter(([, v]) => v).map(([k]) => k).join(", ")}).`);
process.exit(0);
