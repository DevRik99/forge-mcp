# Reglas duras — typescript

| Regla | Verificación | Script o ruta | Qué previene |
|-------|-------------|---------------|--------------|
| `strict: true` obligatorio en `tsconfig.json` | script | lectura de `tsconfig.json`, falla si `compilerOptions.strict` es `false` o está ausente; verificado por `templates/check-tsconfig-strict.mjs` | código que compila con `null`/`undefined` implícitos y tipos débiles sin que nadie lo note |
| Nunca usar `any` | linter | `@typescript-eslint/no-explicit-any` | pérdida de todo el chequeo de tipos en la porción marcada `any`, y su propagación silenciosa al resto del código |
| Nunca usar `!` (non-null assertion) | linter | `@typescript-eslint/no-non-null-assertion` | afirmar que un valor existe sin comprobarlo — la causa típica de "cannot read property of undefined" en producción |
| En bloques `catch`, tipar la variable de error como `unknown`, nunca `any` implícito | linter | `@typescript-eslint/no-implicit-any-catch` (o `useUnknownInCatchVariables` en `tsconfig`) | acceder a propiedades de un error sin verificar su forma primero |
| `import type` para importar solo tipos, no valores | linter | `@typescript-eslint/consistent-type-imports` | imports de tipos que sobreviven al tree-shaking como imports de runtime innecesarios |
| Const object + `as const` en vez de union types declarados directo (`type Status = "active" \| ...`) | no automatizable | — distinguir "este union debería ser un const object" de un union type legítimo exige criterio de diseño, ningún plugin lo resuelve sin falsos positivos | duplicación entre el tipo y sus valores en runtime, autocompletado y refactor más frágiles |
| Interfaces a un solo nivel de profundidad; objetos anidados van en su propia interfaz, no inline | no automatizable | — ningún plugin de ESLint vigente detecta "objeto anidado inline en un tipo" sin marcar también estructuras legítimas | tipos ilegibles y difíciles de reutilizar entre módulos |
