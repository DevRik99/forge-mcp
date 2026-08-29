#!/usr/bin/env node
// Regla: todo input de usuario se valida server-side; consultas SQL siempre
// parametrizadas — verificado con Semgrep y reglas de inyección SQL.
// Por qué: SQL injection es A03 del OWASP Top 10; un SAST corriendo en CI es
// la única defensa que no depende de que cada desarrollador se acuerde de
// parametrizar cada query, siempre.
//
// Este script NO reimplementa el análisis estático (eso lo hace Semgrep).
// Verifica que Semgrep esté configurado en el proyecto con un ruleset que
// cubra inyección SQL.
//
// Uso: node check-semgrep-sqli-configured.mjs [raiz-del-proyecto]

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const PATRON_SQLI = /(sqli|sql-injection|owasp-top-ten|p\/security-audit|p\/ci)/i;

const configCandidatos = [
  path.join(root, ".semgrep.yml"),
  path.join(root, ".semgrep.yaml"),
  path.join(root, "semgrep.yml"),
];
const dirSemgrep = path.join(root, ".semgrep");

function leer(archivo) {
  try {
    return readFileSync(archivo, "utf8");
  } catch {
    return "";
  }
}

let contenidoConfig = "";
for (const candidato of configCandidatos) {
  if (existsSync(candidato)) contenidoConfig += leer(candidato);
}
if (existsSync(dirSemgrep)) {
  for (const archivo of readdirSync(dirSemgrep)) {
    if (/\.ya?ml$/.test(archivo)) contenidoConfig += leer(path.join(dirSemgrep, archivo));
  }
}

let contenidoCI = "";
const workflowsDir = path.join(root, ".github", "workflows");
if (existsSync(workflowsDir)) {
  for (const archivo of readdirSync(workflowsDir).filter((f) => /\.ya?ml$/.test(f))) {
    contenidoCI += leer(path.join(workflowsDir, archivo));
  }
}
contenidoCI += leer(path.join(root, ".gitlab-ci.yml"));

const semgrepEnCI = /semgrep/i.test(contenidoCI);
const reglaSqliPresente = PATRON_SQLI.test(contenidoConfig) || PATRON_SQLI.test(contenidoCI);

if (!semgrepEnCI && contenidoConfig.length === 0) {
  console.error("FAIL: no se encontró configuración de Semgrep ni referencia a semgrep en CI.");
  console.error("Arreglo: agregar un workflow de CI que corra `semgrep --config p/owasp-top-ten` (o un ruleset equivalente con reglas de SQLi).");
  process.exit(1);
}

if (!reglaSqliPresente) {
  console.error("FAIL: Semgrep está presente pero no se detectó un ruleset de inyección SQL / OWASP Top 10.");
  console.error("Arreglo: usar --config p/owasp-top-ten (o agregar explícitamente las reglas *sqli*/*sql-injection* del registro de Semgrep).");
  process.exit(1);
}

console.log("OK: Semgrep configurado con un ruleset que cubre inyección SQL.");
process.exit(0);
