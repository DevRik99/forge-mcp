#!/usr/bin/env node
// Regla: ningún secreto hardcodeado; gitleaks/TruffleHog corren en pre-commit y CI.
// Por qué: un secreto commiteado queda para siempre en el historial de git,
// aunque se borre después — la única defensa real es no dejarlo entrar nunca.
//
// Este script NO reimplementa detección de secretos (eso lo hace gitleaks).
// Verifica que gitleaks esté CONFIGURADO en el punto donde correspondería
// atajar el commit o el PR: un pre-commit hook o un workflow de CI.
//
// Uso: node check-gitleaks-configured.mjs [raiz-del-proyecto]

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

function contieneGitleaks(archivo) {
  if (!existsSync(archivo)) return false;
  try {
    return /gitleaks/i.test(readFileSync(archivo, "utf8"));
  } catch {
    return false;
  }
}

const configPropia = existsSync(path.join(root, ".gitleaks.toml"));

const preCommitCandidatos = [
  path.join(root, ".git", "hooks", "pre-commit"),
  path.join(root, ".husky", "pre-commit"),
  path.join(root, ".pre-commit-config.yaml"),
];
const preCommitOk = preCommitCandidatos.some(contieneGitleaks);

let ciOk = false;
const workflowsDir = path.join(root, ".github", "workflows");
if (existsSync(workflowsDir)) {
  const archivos = readdirSync(workflowsDir).filter((f) => /\.ya?ml$/.test(f));
  ciOk = archivos.some((f) => contieneGitleaks(path.join(workflowsDir, f)));
}
if (!ciOk) {
  ciOk = contieneGitleaks(path.join(root, ".gitlab-ci.yml"));
}

if (!preCommitOk && !ciOk) {
  console.error("FAIL: gitleaks no está configurado ni en pre-commit ni en CI.");
  console.error(`  .gitleaks.toml presente: ${configPropia ? "sí" : "no"}`);
  console.error("Arreglo: agregar gitleaks a un hook de pre-commit (.husky/pre-commit o .git/hooks/pre-commit) Y a un workflow de CI (.github/workflows/*.yml).");
  process.exit(1);
}

console.log(`OK: gitleaks configurado (pre-commit: ${preCommitOk ? "sí" : "no"}, CI: ${ciOk ? "sí" : "no"}).`);
if (!preCommitOk || !ciOk) {
  console.log("SUGERENCIA: gitleaks solo cubre una de las dos etapas; lo ideal es tenerlo en ambas (local rápido + CI como red de respaldo).");
}
process.exit(0);
