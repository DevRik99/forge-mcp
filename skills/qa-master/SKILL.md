---
name: qa-master
description: >
  Unified QA and testing skill. Use when establishing test strategies, writing test cases,
  writing or reviewing unit/integration/E2E tests, doing TDD, choosing test doubles/mocks,
  detecting test smells, tracking bugs, calculating quality metrics, running pre-commit
  verification, or deciding what layer of the testing trophy to target. Covers strategy
  (testing trophy, pyramid, shift-left, AI-assisted testing), test anatomy (AAA, naming,
  determinism), unit/integration/E2E patterns (Vitest, Playwright, Vue Test Utils,
  Supertest), TDD, test smells, testability design, mocking taxonomy, security testing
  (OWASP), CI/CD, and a mandatory pre-commit verification protocol with Gherkin asserts
  and checkpoints. Framework-agnostic, con ejemplos en TypeScript/Vue/Nuxt/NestJS.
---

# QA Master

Skill unificada de aseguramiento de calidad. Combina estrategia, filosofía, patrones de
escritura de tests, ejecución, métricas y verificación en una sola referencia autoritativa.

## Cuándo usar esta skill

- Diseñar o revisar una estrategia de testing para cualquier proyecto
- Decidir qué tipo de test escribir (unit vs integration vs E2E)
- Escribir o revisar tests (unitarios, de integración, E2E)
- Hacer TDD (red-green-refactor)
- Elegir el test double correcto (dummy, stub, spy, mock, fake)
- Detectar y corregir test smells / anti-patrones
- Escribir casos de prueba estandarizados (AAA)
- Trackear y clasificar bugs (P0-P4)
- Calcular quality gates antes de un release
- Correr verificación pre-commit (lint → types → tests → build)
- Implementar testing de seguridad (OWASP)
- Montar infraestructura de QA desde cero
- Entregar QA a un equipo externo

---

## 1. Filosofía: por qué testeamos

### El objetivo real: confianza para cambiar código

El propósito de los tests no es alcanzar un número de cobertura. Es tener **confianza para
modificar, refactorizar y extender código sin miedo a romper funcionalidad existente**. Un
test que no da confianza no tiene valor; un test que da falsa confianza es peor que no tener
test.

> "Testing shows presence of defects, not their absence." — ISTQB, Principio 1

### "Write tests. Not too many. Mostly integration." — Kent C. Dodds

- **Write tests:** no es opcional. El código sin tests es deuda técnica desde el día uno.
- **Not too many:** el ROI de los tests tiene rendimientos decrecientes. Más tests no siempre
  significa más confianza; cada test tiene un costo de mantenimiento.
- **Mostly integration:** los integration tests ofrecen el mejor balance entre confianza y
  costo. Verifican que múltiples unidades colaboran correctamente, sin acoplarse a
  implementación interna.

La filosofía central de Dodds: **"The more your tests resemble the way your software is
used, the more confidence they can give you."** (Testing Library, Guiding Principles)

### London School vs Detroit/Chicago School de TDD

| Aspecto | London School | Detroit/Chicago School |
|---|---|---|
| **Qué aislar** | Toda dependencia excepto valores inmutables | Solo dependencias de I/O (DB, red, filesystem) |
| **Uso de mocks** | Agresivo: mock de todos los colaboradores | Mínimo: solo out-of-process dependencies |
| **Granularidad** | Una clase/función = una unidad | Un comportamiento = una unidad |
| **Fortaleza** | Localiza fallos rápidamente | Tests más resistentes a refactoring |
| **Debilidad** | Tests frágiles, acoplados a implementación | Fallos pueden ser menos específicos |
| **Autores clave** | Freeman & Pryce (GOOS) | Kent Beck, Khorikov |

**Recomendación:** la Detroit School produce tests más mantenibles en la mayoría de los
casos. Usar London School solo cuando la naturaleza del código lo exige (coordinadores
complejos con muchas dependencias de I/O).

Referencia: Khorikov, "Unit Testing: Principles, Practices, and Patterns" (Manning).

### Tests como documentación

Un buen test comunica tres cosas:
1. **Qué** hace el código (el nombre del test).
2. **Bajo qué condiciones** (el Arrange).
3. **Qué resultado se espera** (el Assert).

Si un desarrollador nuevo no puede entender el comportamiento del sistema leyendo los tests,
los tests fallan como documentación.

---

## 2. Estrategia: Qué y cuánto testear

### Testing Trophy (Dodds) vs Testing Pyramid (Cohn)

**Testing Pyramid (Mike Cohn):**
```
     /  E2E  \         ← Pocos, lentos, costosos
    / Integr. \        ← Moderados
   /   Unit    \       ← Muchos, rápidos, baratos
```
Motivación: costo y velocidad correlacionan con el nivel de integración del test.

**Testing Trophy (Kent C. Dodds, 2025 Standard):**
```
          /\
         /E2E\        ← thin: critical user journeys only
        /------\
       /Integra-\     ← heaviest layer: modules working together
      /  tion    \
     /------------\
    /   Unit Tests  \  ← only for pure functions / business logic
   /------------------\
  /  Static Analysis   \  ← ESLint, TypeScript — fast, zero cost
 /______________________\
```

Versión compacta del mismo modelo, para referencia rápida:
```
     ⚬ E2E              ← Pocos
    ━━━ Integration ━━━  ← MAYORÍA (máximo ROI)
     ━ Unit ━            ← Algunos
     · Static ·          ← TypeScript, ESLint (automático)
```

La tesis de Dodds: en 2012 las herramientas de integración/E2E eran caras, lentas y
frágiles, pero para 2017 (Jest, Testing Library, Cypress de esa época) esa asimetría de
costo se redujo, así que el punto óptimo de ROI se corrió hacia integración — un test de
integración detecta más regresiones reales por test escrito que uno unitario que testea una
función aislada de sus colaboradores.

**Por qué el trophy sobre la pirámide, en general:**
- Static analysis (TypeScript + ESLint) reemplaza una gran parte de los unit tests.
- Integration tests dan confianza real sin la flakiness del E2E completo.
- E2E tests son caros de mantener — protegen journeys, no detalles de implementación.

**Modelo de tamaños de Google (small/medium/large + hermeticidad).** No es una jerarquía de
"cuántos escribir" sino una taxonomía de **restricciones de ejecución**: small = un proceso,
sin red/disco/sleep, timeout ~1 min; medium = una máquina, puede usar localhost y red local;
large = puede cruzar máquinas, timeouts de minutos u horas. La proporción objetivo (~80/15/5)
es orientativa; el valor real del modelo es la **hermeticidad obligatoria**: todo test declara
sus dependencias y las controla, nunca asume estado ambiental. Es ortogonal a "unit vs
integration vs E2E" — un E2E mal escrito puede violar hermeticidad tanto como uno unitario
mal escrito. (Winters, Manshreck, Tamplin — "Software Engineering at Google", cap. 11 y 14)

**Agile Testing Quadrants (Brian Marick / Lisa Crispin).** Clasifica por dos ejes: tests que
apoyan al equipo vs tests que critican el producto, y tests orientados a negocio vs a
tecnología. Es complementario, no competidor — responde "¿qué tipo de test es este, para
quién?", no "¿cuántos de cada uno?". Útil para no olvidar categorías como exploratory
testing o tests de performance/seguridad, que ni la pirámide ni el trophy cubren.

**Cuál usar según capa del stack:**
- **Backend (NestJS):** la pirámide aplica mejor. Muchos unit tests para lógica de negocio
  pura, integration tests para módulos + DB, pocos E2E.
- **Frontend (Vue/Nuxt):** el trophy aplica mejor. Los componentes tienen poco valor
  testeados en aislamiento; la confianza viene de integration tests que montan componentes
  con sus dependencias reales.
- **Nuxt con SSR/rutas de servidor** agrega una capa (`server/api/*`) que necesita su propia
  franja de tests de integración con Supertest o equivalente, sin pasar por navegador — no
  encaja limpio en ninguno de los dos modelos importados de SPA pura.

### Decision flow

```
¿Es lógica pura sin dependencias?
  → Sí: Unit test (Vitest / Jest / pytest)
  → No: seguir...

¿Es un loader / action / service method con 1-2 llamadas externas?
  → Sí: Integration test con MSW o DB real en memoria
  → No: seguir...

¿Involucra interacción de usuario, routing, o estado cross-system?
  → Sí: E2E test (Playwright)

¿Escribirlo requeriría 3+ mocks?
  → Sí: E2E test — over-mocking es un code smell
```

### Distribución recomendada

No hay porcentajes universales. Depende de la complejidad del dominio:

| Tipo | Dominio complejo (mucha lógica) | Dominio simple (CRUD) |
|---|---|---|
| Unit | 50-60% | 10-20% |
| Integration | 30-40% | 60-70% |
| E2E | 5-10% | 10-20% |

### ROI de cada tipo de test

| Tipo | Costo escritura | Costo mantenimiento | Velocidad | Confianza |
|---|---|---|---|---|
| Static (TS/ESLint) | Bajo (automático) | Casi nulo | Instantáneo | Baja (solo tipos/sintaxis) |
| Unit | Bajo | Bajo-Medio | Muy rápido | Media |
| Integration | Medio | Medio | Rápido-Medio | Alta |
| E2E | Alto | Alto | Lento | Muy alta |

### Code coverage: qué mide y qué NO mide

**Qué mide:** porcentaje de líneas/ramas/funciones ejecutadas durante los tests.

**Qué NO mide:**
- Si los assertions son correctos (puedes ejecutar código sin verificar nada).
- Si los edge cases están cubiertos.
- Si el test es mantenible o legible.
- Si el comportamiento del usuario está verificado.

**Threshold:** usar cobertura como **indicador, no como meta**. Un proyecto con 60% de
cobertura bien hecha tiene más valor que uno con 95% de cobertura superficial. Un threshold
razonable: 70-80% como piso, nunca como objetivo de optimización.

> "Coverage is a starting point, never an end goal." — Khorikov

**Umbral global vs por-diff:** exigir un porcentaje agregado sobre todo el proyecto es
insuficiente — se cumple con archivos históricos bien cubiertos mientras el código nuevo del
PR queda sin ningún test; la cobertura agregada no dice nada sobre lo que se acaba de
escribir. Preferir `coverage.thresholds` **por archivo/glob** (Vitest lo soporta nativo con
`perFile`) sobre un único número global.

### Cuándo NO escribir tests

- **Código de glue:** adaptadores triviales que solo conectan APIs sin lógica.
- **Scripts de un solo uso:** migraciones, seeds, scripts de deployment.
- **Prototipos/spikes:** código exploratorio que se va a tirar.
- **Getters/setters triviales:** sin lógica, sin transformación.
- **Configuración declarativa:** archivos de config, rutas estáticas.

### Mocking Rules (resumen — catálogo completo en §7)

```
Zero mocks → ideal (función pura)
1-2 endpoints MSW → aceptable (integration test)
3+ mocks → escribir un E2E test en su lugar
Nunca mockear: internals del framework, routing, librerías de UI de terceros
Aceptable: MSW para llamadas API, fake timers, variables de entorno
```

### Mutation testing

**Qué es:** herramienta que introduce cambios pequeños (mutaciones) en el código fuente
(cambiar `>` por `<`, `+` por `-`, `true` por `false`) y verifica si los tests detectan el
cambio. Si un mutante sobrevive, hay un hueco en los tests — es la única verificación que
distingue "hay tests" de "los tests protegen algo": cobertura alta con mutación baja
significa que el código se ejecuta pero no se verifica.

**Cuándo vale la pena:**
- Lógica de negocio crítica (cálculos financieros, permisos, validaciones).
- Librerías/utilidades reutilizables.

**Cuándo NO vale la pena:**
- Código CRUD simple.
- UI components (el costo de ejecución es muy alto).
- En cada PR (demasiado lento) — usar modo `--incremental` en PR y full run nightly/pre-release.

**Herramienta:** StrykerJS, con soporte nativo para Vitest desde v7. Configurar
`thresholds.break` para que el CI corte si el score cae por debajo del umbral.

Referencia: Sentry Engineering, "Mutation-testing our JavaScript SDKs"; docs oficiales de
Stryker Mutator.

### Shift-Left Principle

El testing no es una fase — arranca en la planificación.
- Incluir QA en sesiones de diseño y grooming.
- Escribir casos de prueba antes o junto con la implementación.
- Los desarrolladores son dueños de la calidad de los tests, no solo del número de cobertura.
- Atrapar bugs donde cuestan menos: diseño > código > integración > producción.

### Testing asistido por IA (2025-2026): qué resuelve y qué no

Usar tooling de IA para amplificar el juicio de ingeniería, no para reemplazarlo:

| Rol | La IA ayuda con | El humano debe |
|------|--------------|------------|
| Generación de tests | Scaffolding de casos desde flujos o el árbol de accesibilidad | Revisar que los asserts sean correctos |
| Locator healing | Sugerir selectores actualizados tras un refactor de UI | Verificar que el comportamiento no cambió |
| Detección de flakiness | Identificar patrones de rerun-pass en runs de CI | Decidir el fix de causa raíz |
| Análisis de cobertura | Exponer paths sin testear | Priorizar por riesgo |

**Herramientas en uso activo:**
- `@playwright/mcp` — scaffolding de tests guiado por IA vía árbol de accesibilidad.
- ScoutQA CLI — testing exploratorio autónomo (`scoutqa --url ... --prompt ...`).
- Sugerencias de self-healing locators — aceptar solo cuando los asserts siguen siendo fuertes.

**Regla dura:** auto-healing que debilita assertions es peor que un test que falla. Un test
que falla es una señal; un test que pasa con assertions debilitadas es una mentira.

**Qué resuelve realmente la combinación Playwright + IA (y qué no):**

La objeción histórica de Google (2015, "Just Say No to More End-to-End Tests") contra el
E2E tenía tres patas: (a) costo de escritura, (b) flakiness/lentitud, (c) debugging difícil
y ownership difuso.

- **(a) y (c) están razonablemente resueltos.** Generar un test Playwright desde una
  historia de usuario es hoy trivial. El self-healing (intent-based o attribute-based)
  elimina entre 70% y 90% de los fallos inducidos por cambios de UI (QA Wolf, Shiplight,
  2026). El trace viewer de Playwright (screenshots, network, DOM snapshots por acción)
  ataca directamente el problema de debugging a distancia.
- **(b) sigue en pie en su núcleo.** Solo ~28% de los fallos de E2E vienen de selectores
  frágiles — el resto (timing, aserciones visuales estrictas, datos de prueba malos,
  errores de runtime, condiciones de carrera reales entre red y DOM) **no lo arregla ningún
  selector inteligente**. El propio auto-wait de Playwright comprueba estado del DOM pero no
  espera respuestas de red en vuelo: un componente puede quedar "visible" antes de que
  lleguen sus datos, y eso sigue rompiendo tests igual que en 2015. La IA tampoco acelera un
  navegador real — el costo de wall-clock en CI se mitiga con sharding y paralelismo
  (nativo de Playwright), no con IA.
- **Riesgo nuevo que la IA introduce: tests que siempre pasan.** Es más grave que "no
  resuelve" — es un antipatrón nuevo. Investigación de 2026 documenta *test overfitting*:
  sistemas basados en LLM que pasan los tests observados pero fallan en tests ocultos
  equivalentes (arXiv 2511.16858). Reportes del mismo año documentan "paper tests":
  placeholders o mocks que satisfacen la forma del test sin validar lógica real, generando
  **falsa confianza** — peor que no tener el test, porque la suite en verde oculta el
  problema en vez de señalarlo. El mutation testing (arriba) es precisamente el verificador
  que un test generado por IA necesita con más urgencia que uno escrito a mano.
- **Datos de magnitud (2025-2026):** ~16% de los tests en Google exhiben flakiness, y 84% de
  las transiciones pass→fail en post-submit son flaky, no regresión real (ACM OOPSLA, 2020,
  cifra citada ampliamente desde entonces). El E2E ronda 10% de flakiness vs <1% en unit
  (industria, ~2023-2025). Atlassian reportó +150.000 horas de developer-time perdidas al
  año por flakiness (dic. 2025). El mantenimiento de tests consume 20% del tiempo del equipo
  (mabl, 2025) y 30-70% del esfuerzo total de testing según series históricas de Capgemini —
  cifra *anterior* a la explosión de generación asistida por IA; más tests generados sin
  criterio de capa **agrava** ese número, no lo reduce.

**Conclusión operativa:** la pirámide/trophy sigue siendo la estrategia correcta, no por
nostalgia sino porque el costo de wall-clock y la naturaleza no determinista del E2E no
cambiaron — lo que cambió es el costo de *entrada*. Usar IA para bajar la barrera de
escritura del E2E es legítimo, pero no es licencia para invertir la pirámide; sigue habiendo
que ser deliberado sobre qué merece E2E y vigilar activamente el antipatrón del "test que
siempre pasa" con mutation testing.

---

## 3. Anatomía de un buen test

### Los cuatro pilares (Khorikov)

Todo test se evalúa contra cuatro dimensiones:

1. **Protección contra regresiones:** detecta bugs cuando el código cambia.
2. **Resistencia al refactoring:** no se rompe cuando cambia la implementación sin cambiar
   el comportamiento.
3. **Feedback rápido:** se ejecuta en milisegundos (unit) o pocos segundos (integration).
4. **Mantenibilidad:** fácil de leer, entender y modificar.

No se pueden maximizar las cuatro simultáneamente. Los unit tests maximizan feedback rápido
pero sacrifican algo de protección. Los integration tests maximizan protección pero son más
lentos. El balance correcto depende del contexto.

### AAA: Arrange-Act-Assert

Patrón obligatorio (AAA Pattern). Todo test debe seguir: **Arrange → Act → Assert**, con las tres partes visualmente
separadas (línea en blanco o comentario si el bloque es largo). Un test que mezcla arrange y
assert intercalados es difícil de auditar de un vistazo.

```typescript
// E2E — Playwright
test('user can place an order', async ({ page }) => {
  // Arrange
  await createTestingAccount(page, { account_status: 'active' });
  await page.goto('/catalog');

  // Act
  await page.getByLabel('Quantity').fill('1');
  await page.getByRole('button', { name: 'Buy' }).click();

  // Assert
  await expect(page.getByAltText('Thank you')).toBeVisible();
});
```

```typescript
// Unit — Vitest
it('should calculate total price with tax when items have different rates', () => {
  // Arrange
  const items = [
    { name: 'Book', price: 100, taxRate: 0.10 },
    { name: 'Electronics', price: 200, taxRate: 0.21 },
  ];

  // Act
  const totalPrice = calculateTotalWithTax(items);

  // Assert
  expect(totalPrice).toBe(352);
});

// DON'T: mezclar arrange/act/assert
it('should work', () => {
  expect(calculateTotalWithTax([{ name: 'A', price: 100, taxRate: 0.1 }])).toBe(110);
  const items = [{ name: 'B', price: 200, taxRate: 0.21 }];
  items.push({ name: 'C', price: 50, taxRate: 0 });
  expect(calculateTotalWithTax(items)).toBe(292);
});
```

### Un solo Assert conceptual por test

Un test debe verificar **un solo comportamiento**. Puede tener múltiples `expect()` si todas
verifican facetas del mismo resultado. Si el nombre del test necesita "y" para describirlo,
son dos tests.

```typescript
// DO: múltiples assertions sobre el mismo resultado conceptual
it('should create user with correct properties', () => {
  const user = createUser({ name: 'Erik', email: 'erik@test.com' });

  expect(user.name).toBe('Erik');
  expect(user.email).toBe('erik@test.com');
  expect(user.createdAt).toBeInstanceOf(Date);
});

// DON'T: múltiples comportamientos en un test
it('should create and update user', () => {
  const user = createUser({ name: 'Erik' });
  expect(user.name).toBe('Erik');

  updateUser(user.id, { name: 'Updated' });
  const updated = getUser(user.id);
  expect(updated.name).toBe('Updated'); // Esto es otro test
});
```

### Nombres de tests

Formato: `should [behavior] when [condition]`. El nombre debe alcanzar para entender qué
falló sin leer el cuerpo del test, y describir el comportamiento observable, no la
implementación (`"muestra error cuando el email es inválido"`, no `"llama a validateEmail"`).

```typescript
// DO
it('should return empty array when no tasks match the filter criteria', () => {});
it('should throw ValidationError when email format is invalid', () => {});
it('should apply discount when order total exceeds minimum threshold', () => {});

// DON'T
it('test filter', () => {});
it('email validation', () => {});
it('works correctly', () => {});
```

### Test Case ID Format (para tracking, no para el nombre del test en código)

`TC-[CATEGORY]-[NUMBER]` — p. ej. `TC-AUTH-001`, `TC-CHECKOUT-042`, `TC-SEC-007`.

Categorías: `AUTH`, `CHECKOUT`, `DASHBOARD`, `API`, `SEC`, `A11Y`, `PERF`, `CLI`.

### Test independence

Cada test debe poder ejecutarse en cualquier orden y producir el mismo resultado. No
depender de estado dejado por tests anteriores. Correr con `--shuffle` / orden aleatorio en
CI es el gate que expone esta violación (Vitest y Playwright lo soportan).

```typescript
// DON'T: tests acoplados por estado compartido
let sharedUser: User;

it('should create user', () => {
  sharedUser = createUser({ name: 'Erik' });
  expect(sharedUser).toBeDefined();
});

it('should update the created user', () => {
  // Falla si el test anterior no corrió primero
  updateUser(sharedUser.id, { name: 'Updated' });
});

// DO: cada test configura su propio estado
it('should update user name', () => {
  const user = createUser({ name: 'Erik' });
  updateUser(user.id, { name: 'Updated' });
  const result = getUser(user.id);
  expect(result.name).toBe('Updated');
});
```

### Determinismo

Un test no determinista (flaky) es peor que no tener test: erosiona la confianza en la
suite completa. Fowler documenta cinco causas ("Eradicating Non-Determinism in Tests") — la
cuarentena nunca es la solución final, solo un parche temporal mientras se corrige la causa.

| Causa | Solución |
|---|---|
| `Date.now()` / tiempo real | Inyectar clock, `vi.useFakeTimers()` |
| `Math.random()` | Seed fijo o inyectar generador |
| Estado global mutable | Limpiar en `beforeEach` / `afterEach` |
| Orden de ejecución | Tests independientes, no compartir estado |
| Network calls reales | Mock o fake server |
| Race conditions async | `await` explícito, no `setTimeout` en tests |

### Velocidad de feedback

| Tipo | Target | Límite aceptable |
|---|---|---|
| Un unit test | < 10ms | < 50ms |
| Suite de unit tests | < 1s | < 5s |
| Un integration test | < 100ms | < 500ms |
| Suite de integration tests | < 30s | < 2min |
| Un E2E test | < 5s | < 30s |
| Suite de E2E tests | Variable | < 15min |

### Sin lógica condicional en el test

Nada de `if`, loops con ramas, o `try/catch` que oculte fallos dentro de un test. Un test
con lógica es código que también necesita testearse — contradice su propio propósito.

### Selectores por accesibilidad, no por implementación

Jerarquía de Testing Library, en orden de preferencia: `getByRole` > `getByLabelText` >
`getByPlaceholderText` > `getByText` > `getByDisplayValue` > `getByAltText` > `getByTitle` >
`getByTestId` (último recurso). El orden refleja cómo un usuario real —con o sin tecnología
asistiva— encuentra el elemento; `getByTestId` es invisible para el usuario, así que es la
señal más débil de que el componente es usable. Misma lógica aplica en Playwright (ver §5).

### Evitar nesting excesivo

`describe` anidados con `beforeEach` compartido fuerzan a usar hooks como mecanismo de
reuso, obligando a rastrear variables mutables a través de múltiples niveles para entender
un solo test (Kent C. Dodds, "Avoid Nesting when you're Testing").

### La prueba de que un test protege algo: romperlo a propósito

No hay un nombre único consolidado en la literatura para esto, pero es la base operativa del
mutation testing (§2) y está alineada con la Beyoncé Rule de Google: *"if you liked it, you
shoulda put a test on it"* — el corolario práctico es que un test que no puede fallar no
cuenta como protección.

---

## 4. Unit Tests

### Definición precisa

> "A unit test is a test that verifies a single unit of behavior, runs quickly, and does it
> in isolation from other tests." — Osherove/Khorikov

**Unidad = comportamiento, no función/clase.** Un "unit test" puede ejecutar múltiples
funciones y clases si todas son parte del mismo comportamiento lógico.

### Qué es una "unidad"

```typescript
// La "unidad" NO es la función `calculateDiscount`
// La "unidad" es el COMPORTAMIENTO: "aplicar descuento por volumen"

// DO: testear el comportamiento completo
it('should apply 10% volume discount when quantity exceeds 100 units', () => {
  const order = createOrder({ productId: 'ABC', quantity: 150, unitPrice: 10 });
  const finalPrice = calculateOrderTotal(order); // Puede llamar internamente a calculateDiscount
  expect(finalPrice).toBe(1350); // 150 * 10 * 0.9
});

// DON'T: testear funciones internas aisladas
it('should return 0.1 for quantity > 100', () => {
  expect(calculateDiscount(150)).toBe(0.1); // Acoplado a implementación interna
});
```

### Output-based testing (Khorikov)

El estilo más mantenible. El test solo verifica el **output** de una función dado un input,
sin inspeccionar estado interno ni verificar llamadas. Preferencia: output-based >
state-based > communication-based. Usar communication-based (mocks que verifican llamadas)
solo para verificar side effects hacia sistemas externos (enviar email, publicar evento).

```typescript
// DO: output-based — el más mantenible
it('should format currency with two decimals and dollar sign', () => {
  const result = formatCurrency(1234.5);
  expect(result).toBe('$1,234.50');
});

// LESS IDEAL: state-based — verifica estado interno
it('should add item to cart', () => {
  const cart = new Cart();
  cart.addItem({ id: '1', price: 10 });
  expect(cart.items).toHaveLength(1); // Inspecciona estado interno
});

// DON'T: communication-based — verifica llamadas
it('should call repository.save', () => {
  const mockRepo = { save: vi.fn() };
  const service = new OrderService(mockRepo);
  service.createOrder({ product: 'X' });
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ product: 'X' })); // Frágil
});
```

### Ejemplo completo en Vitest

```typescript
import { describe, it, expect } from 'vitest';
import { calculateMonthlyPayment } from './loan-calculator';

describe('calculateMonthlyPayment', () => {
  it('should calculate correct payment for standard loan terms', () => {
    const payment = calculateMonthlyPayment({
      principal: 200_000,
      annualInterestRate: 0.05,
      termInMonths: 360,
    });

    expect(payment).toBeCloseTo(1073.64, 2);
  });

  it('should return zero when principal is zero', () => {
    const payment = calculateMonthlyPayment({
      principal: 0,
      annualInterestRate: 0.05,
      termInMonths: 360,
    });

    expect(payment).toBe(0);
  });

  it('should throw when term is zero months', () => {
    expect(() =>
      calculateMonthlyPayment({
        principal: 200_000,
        annualInterestRate: 0.05,
        termInMonths: 0,
      })
    ).toThrow('Term must be at least one month');
  });
});
```

---

## 5. Integration Tests

### Definición

Tests que verifican que **múltiples unidades funcionan juntas** correctamente, incluyendo al
menos una dependencia que cruza un boundary (DB, HTTP, filesystem, otro módulo).

### Qué integrar

| Stack | Integración recomendada |
|---|---|
| NestJS | Módulo + DB real (SQLite/Postgres de test) + Supertest |
| Vue/Nuxt | Componente + composables + store (si aplica), MSW en el borde de red |
| API externa | Módulo + fake/stub del servicio externo |

### Base de datos en tests: usar DB real

```typescript
// DO: usar DB real con cleanup
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';

describe('TaskController (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Task],
          synchronize: true,
        }),
        TaskModule,
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create and retrieve a task', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/tasks')
      .send({ title: 'Test task', priority: 'high' })
      .expect(201);

    const taskId = createResponse.body.id;

    const getResponse = await request(app.getHttpServer())
      .get(`/tasks/${taskId}`)
      .expect(200);

    expect(getResponse.body).toEqual(
      expect.objectContaining({
        id: taskId,
        title: 'Test task',
        priority: 'high',
      })
    );
  });
});

// DON'T: mockear el repositorio en integration tests
it('should create task', async () => {
  const mockRepo = { save: vi.fn().mockResolvedValue({ id: 1 }) };
  // Esto es un unit test disfrazado de integration test
});
```

**Por qué DB real:** los mocks de repositorios no detectan errores de queries, constraints,
migraciones, ni comportamientos específicos del motor de DB. La confianza de un integration
test con mock de DB es falsa.

### Fixtures y seed data

```typescript
// DO: factory functions claras
function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    title: 'Default task',
    description: 'Test description',
    priority: 'medium',
    status: 'pending',
    ...overrides,
  };
}

it('should filter tasks by priority', async () => {
  await taskRepo.save([
    createTestTask({ priority: 'high' }),
    createTestTask({ priority: 'low' }),
    createTestTask({ priority: 'high' }),
  ]);

  const highPriorityTasks = await taskService.findByPriority('high');
  expect(highPriorityTasks).toHaveLength(2);
});

// DON'T: datos mágicos sin contexto (Mystery Guest smell, ver §8)
it('should filter', async () => {
  await seedFromFile('./fixtures/tasks.json'); // Qué hay en ese archivo?
  const result = await taskService.findByPriority('high');
  expect(result).toHaveLength(2); // Por qué 2?
});
```

**Cleanup entre tests:** usar transacciones con rollback o truncate de tablas en
`beforeEach`.

### Supertest para NestJS: patrón correcto

```typescript
// DO: test completo del endpoint
it('should return 400 when creating task without required title', async () => {
  const response = await request(app.getHttpServer())
    .post('/tasks')
    .send({ priority: 'high' }) // Sin title
    .expect(400);

  expect(response.body.message).toContain('title');
});

// DO: test con autenticación
it('should return 401 when no token provided', async () => {
  await request(app.getHttpServer())
    .get('/tasks')
    .expect(401);
});

it('should return tasks for authenticated user', async () => {
  const token = await getTestAuthToken();

  const response = await request(app.getHttpServer())
    .get('/tasks')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(response.body).toBeInstanceOf(Array);
});
```

### Vue Test Utils + composables

```typescript
import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import TaskList from './TaskList.vue';

// DO: montar con dependencias reales (integration)
it('should render tasks and filter by status', async () => {
  const wrapper = mount(TaskList, {
    global: {
      plugins: [
        createTestingPinia({
          initialState: {
            tasks: {
              items: [
                { id: 1, title: 'Task A', status: 'done' },
                { id: 2, title: 'Task B', status: 'pending' },
              ],
            },
          },
        }),
      ],
    },
  });

  await wrapper.find('[data-id="filter-pending"]').trigger('click');

  const visibleTasks = wrapper.findAll('[data-id="task-item"]');
  expect(visibleTasks).toHaveLength(1);
  expect(visibleTasks[0].text()).toContain('Task B');
});
```

---

## 6. E2E Tests

### Cuándo E2E y no integration

| Escenario | Tipo de test |
|---|---|
| Verificar que un módulo + DB funciona | Integration |
| Verificar que el usuario puede completar un flujo | E2E |
| Verificar CSS, layout, responsive | E2E (visual regression) |
| Verificar permisos de usuario en la UI | E2E |
| Verificar lógica de cálculo pura | Unit |

### Playwright: configuración recomendada

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
});
```

### Selectores: jerarquía correcta

```typescript
// DO (en orden de preferencia):
page.getByRole('button', { name: 'Save task' });    // 1. ARIA roles
page.getByLabel('Task title');                        // 2. Labels
page.getByText('No tasks found');                     // 3. Texto visible
page.getByTestId('task-list');                        // 4. data-testid
page.locator('[data-id="task-item"]');                // 4b. data-id (convención del proyecto)

// DON'T:
page.locator('.task-list__item');                      // Clases CSS (frágiles)
page.locator('#task-1');                               // IDs generados
page.locator('div > ul > li:nth-child(2)');           // Estructura del DOM
```

### Page Object Model

Cuándo usar, y su alternativa —helpers de dominio— para flujos que cruzan varias pantallas.

**Cuándo usar POM:** cuando hay 10+ tests que interactúan con la misma página y los
selectores se repiten.

**Cuándo es over-engineering:** páginas simples con 2-3 tests. El POM agrega una capa de
indirección que dificulta la lectura si no se justifica.

**Helpers de dominio** (`loginAs(user)`, `addToCart(product)`) expresan intención de negocio
y pueden componer varios Page Objects. Para flujos que cruzan varias pantallas, el helper de
dominio es más legible que encadenar objetos de página.

```typescript
// DO: POM para páginas complejas
class TaskListPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/tasks');
  }

  async createTask(title: string) {
    await this.page.getByRole('button', { name: 'New task' }).click();
    await this.page.getByLabel('Title').fill(title);
    await this.page.getByRole('button', { name: 'Save' }).click();
  }

  async getTaskCount() {
    return this.page.getByTestId('task-item').count();
  }
}

// DON'T: POM para un test simple
class LoginPage {
  // No necesitas esto si solo tienes 1-2 tests de login
}
```

### Flakiness: causas y soluciones

| Causa | Solución |
|---|---|
| Esperar por tiempo fijo | Usar `waitForSelector`, `waitForResponse`, assertions con auto-retry |
| Estado previo de otro test | Cada test limpia su estado o usa datos únicos |
| Animaciones | Deshabilitarlas en test mode |
| Network lento/flaky | Interceptar requests críticos con `page.route()` |
| Race condition en UI | Usar `expect(locator).toBeVisible()` en vez de chequeo inmediato |

```typescript
// DON'T
await page.click('[data-id="save"]');
await page.waitForTimeout(2000); // Magic number, frágil
expect(await page.textContent('.result')).toBe('Saved');

// DO
await page.click('[data-id="save"]');
await expect(page.getByText('Task saved successfully')).toBeVisible();
```

### Cuántos E2E

- Cubrir **happy paths críticos**: login, crear entidad principal, flujo de compra, etc.
- **No cubrir edge cases** con E2E — eso es para unit/integration.
- Regla práctica: si un flujo roto bloquea al usuario, merece un E2E.

> Para el protocolo completo de E2E en este proyecto, ver skill `testsprite`.

### Manual operativo de Playwright (detalle)

**Aislamiento por test:** cada test corre en un `BrowserContext` nuevo por default —
equivalente a una ventana de incógnito, sin compartir cookies/localStorage con otros tests.
No hay que configurar nada para esto; romperlo (compartir contexto a propósito) es la
excepción, no la regla.

**Fixtures:** `test.extend()` permite definir fixtures propias, con setup antes de `use()` y
teardown después. Dos scopes: por-test (default, se recrea en cada test) y `{ scope:
'worker' }` (se crea una vez por proceso worker — útil para una cuenta de prueba única por
worker en vez de crear una cuenta por test).

**Auth sin repetir login — `storageState`:** loguearse una vez (en un `setup` project o
globalmente), guardar el estado (`page.context().storageState({ path: 'auth.json' })`), y
los tests reales arrancan ya autenticados cargando ese archivo. Evita que cada test pague el
costo de wall-clock de un login real.

**Datos de prueba — seed/API, no UI:** crear el estado previo (usuario, carrito, pedido)
navegando la interfaz es un antipatrón — encadena el test a un flujo que no es el que se
quiere probar y multiplica el tiempo de ejecución. Preferencia: seed directo en base de
datos de test, o llamada a la API. La UI se reserva para lo que el test realmente verifica.

**Web-first assertions:** `await expect(locator).toBeVisible()` reintenta automáticamente
hasta cumplirse o hacer timeout — no requiere `waitFor` manual. Es la razón principal por la
que Playwright elimina la categoría de flakiness más común (timing, ~45% de los casos según
benchmarks de 2026), pero **no cubre esperar una respuesta de red en vuelo** cuando el
elemento ya es visible antes de que lleguen sus datos — ahí sigue haciendo falta esperar la
señal de red explícitamente (`waitForResponse` o una assertion sobre el contenido final, no
solo la visibilidad).

**Trace viewer:** graba snapshots de DOM, red, consola y screenshots por cada acción. Se
activa con `trace: 'on-first-retry'` (balance costo/utilidad — no grabar en todo pase verde)
y se inspecciona con `npx playwright show-trace trace.zip`.

**Sharding y paralelismo en CI:** Playwright reparte los archivos de test entre workers
(`--shard=1/4`) y corre cada archivo con paralelismo interno de tests. Ataca directamente el
costo de wall-clock.

**Comparación visual:** `toHaveScreenshot()` es costosa de mantener (cualquier cambio de
fuente/render del SO genera diffs falsos) — usar con moderación, solo en componentes
visualmente críticos y estables, nunca como sustituto de un assert funcional.

**Component testing:** Playwright puede montar un componente Vue aislado (sin toda la app)
para probar su comportamiento en un navegador real — útil como capa intermedia entre
integración con Vitest (jsdom) y E2E completo, cuando el componente depende de APIs de
navegador que jsdom no simula bien.

**Accesibilidad como assert dentro de un E2E:** `@axe-core/playwright` permite `await new
AxeBuilder({page}).analyze()` como una aserción más del test — detecta violaciones WCAG
automatizables (contraste, atributos ARIA faltantes, etc.). Su límite: solo cubre lo
mecánicamente verificable; no reemplaza una auditoría de a11y real de flujo y foco.

---

## 7. Test Doubles — Catálogo completo

Taxonomía de Gerard Meszaros, popularizada por Martin Fowler en "Mocks Aren't Stubs".

### Dummy

Objeto que se pasa para llenar parámetros pero **nunca se usa**.

```typescript
const dummyLogger = {} as Logger;
const service = new TaskService(taskRepository, dummyLogger);
```

### Stub

Retorna **valores predefinidos**. No verifica cómo fue llamado.

```typescript
const stubUserService = {
  findById: vi.fn().mockResolvedValue({ id: '1', name: 'Erik', role: 'admin' }),
};

it('should grant access when user is admin', async () => {
  const result = await authService.checkAccess('1', '/admin');
  expect(result.granted).toBe(true); // Verifica el RESULTADO, no si findById fue llamado
});
```

### Spy

Registra llamadas. Puede ejecutar la implementación real o retornar valores predefinidos.

```typescript
const emailSpy = vi.spyOn(emailService, 'send');

await userService.register({ email: 'erik@test.com' });

expect(emailSpy).toHaveBeenCalledWith(
  expect.objectContaining({ to: 'erik@test.com', template: 'welcome' })
);
```

### Mock

Objeto **pre-programado con expectativas** que verifican comportamiento. La distinción clave
con un stub: el mock **falla el test si no se cumple la expectativa**.

```typescript
const mockPaymentGateway = {
  charge: vi.fn().mockResolvedValue({ transactionId: 'tx-123' }),
};

await orderService.processPayment(orderId);

expect(mockPaymentGateway.charge).toHaveBeenCalledOnce();
expect(mockPaymentGateway.charge).toHaveBeenCalledWith(
  expect.objectContaining({ amount: 99.99, currency: 'USD' })
);
```

### Fake

Implementación funcional simplificada. Funciona de verdad pero no es apta para producción.

```typescript
class FakeTaskRepository implements TaskRepository {
  private tasks: Map<string, Task> = new Map();

  async save(task: Task): Promise<Task> {
    this.tasks.set(task.id, task);
    return task;
  }

  async findById(id: string): Promise<Task | null> {
    return this.tasks.get(id) ?? null;
  }

  async findAll(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }
}
```

### Cuándo usar cada uno

| Double | Usar cuando... |
|---|---|
| Dummy | Necesitas llenar un parámetro que no afecta el test |
| Stub | Necesitas controlar inputs indirectos (respuestas de dependencias) |
| Spy | Necesitas verificar un side effect (email enviado, evento publicado) |
| Mock | Necesitas verificar la interacción completa con una dependencia externa |
| Fake | Necesitas comportamiento real pero sin infraestructura (in-memory DB, fake filesystem) |

### Regla de Fowler: "Mocks aren't stubs"

La diferencia fundamental: los **stubs** facilitan el test proveyendo datos; los **mocks**
verifican comportamiento. Confundirlos lleva a tests frágiles que verifican implementación
en vez de resultados.

### Cuándo NO mockear

- **No mockear lo que no es tuyo** (en general): mockear `fetch`, `fs`, o librerías de
  terceros acopla tus tests a la API interna de esas librerías. Preferir wrappers propios
  que puedas controlar.
- **Excepción válida:** `vi.useFakeTimers()` para `Date.now()` y timers. Estándar y estable.
- **Excepción válida:** MSW (Mock Service Worker) para interceptar HTTP en tests de
  frontend — intercepta **en el borde de red**, no en el cliente HTTP ni en módulos internos,
  lo cual evita acoplar el test a la librería de fetching que se use.

### Vitest: API de test doubles

```typescript
import { vi, describe, it, expect } from 'vitest';

// vi.fn() — crear un mock/stub desde cero
const mockFn = vi.fn();
const stubFn = vi.fn().mockReturnValue(42);
const asyncStubFn = vi.fn().mockResolvedValue({ data: 'test' });

// vi.spyOn() — espiar un método existente
const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

// vi.mock() — mockear un módulo completo
vi.mock('./email-service', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

// Limpieza
afterEach(() => {
  vi.restoreAllMocks(); // Restaura implementaciones originales
});
```

Referencia: Justin Searls, "Please don't mock me" (JSConf US 2018) — 9 abusos comunes de
mocks y 1 workflow que los usa correctamente.

---

## 8. TDD — Test-Driven Development

### Red-Green-Refactor: el ciclo de Kent Beck

1. **Red:** escribir un test que falla. El test describe el comportamiento deseado.
2. **Green:** escribir el código **mínimo** para que el test pase. Vale "hacer trampa"
   (hardcodear valores, duplicar código).
3. **Refactor:** eliminar duplicación y mejorar diseño **sin cambiar comportamiento**. Los
   tests deben seguir pasando.

```typescript
// PASO 1 — RED: el test falla porque fizzbuzz no existe
it('should return "1" for input 1', () => {
  expect(fizzbuzz(1)).toBe('1');
});

// PASO 2 — GREEN: implementación mínima
function fizzbuzz(n: number): string {
  return '1'; // Hardcodeado, pero el test pasa
}

// PASO 3 — Agregar otro test, el hardcode ya no funciona
it('should return "2" for input 2', () => {
  expect(fizzbuzz(2)).toBe('2');
});

// GREEN de nuevo: generalizar
function fizzbuzz(n: number): string {
  return String(n);
}

// Continuar con "Fizz", "Buzz", "FizzBuzz"...
```

### Triangulación

Cuando no sabes cómo generalizar, agrega más ejemplos específicos hasta que el patrón
emerge:

```typescript
it('should return "Fizz" for 3', () => expect(fizzbuzz(3)).toBe('Fizz'));
it('should return "Fizz" for 6', () => expect(fizzbuzz(6)).toBe('Fizz'));
it('should return "Fizz" for 9', () => expect(fizzbuzz(9)).toBe('Fizz'));
// Ahora es obvio: divisible por 3 → "Fizz"
```

### Baby steps: por qué los pasos pequeños son más rápidos

- Cada paso es verificable inmediatamente.
- Si algo se rompe, sabes exactamente qué cambio lo causó.
- No acumulas incertidumbre.
- Contraintuitivo pero cierto: muchos pasos pequeños y seguros son más rápidos que un gran
  salto con debugging posterior.

### Outside-in TDD (GOOS — Freeman & Pryce)

1. Escribir un **test de aceptación** (E2E o integration de alto nivel) que describe el
   feature completo. Este test estará rojo durante todo el desarrollo.
2. Implementar de afuera hacia adentro usando TDD interno (unit tests) para cada pieza.
3. Cuando todos los tests internos pasan y la funcionalidad está completa, el test de
   aceptación se pone verde.

```
[Acceptance Test: ROJO] ───────────────────────────── [Acceptance Test: VERDE]
   │                                                         ▲
   ├── [Unit test 1: rojo → verde → refactor]                │
   ├── [Unit test 2: rojo → verde → refactor]                │
   ├── [Integration test: rojo → verde]                      │
   └── [Unit test 3: rojo → verde → refactor] ───────────────┘
```

### TDD no es "test first"

TDD es **diseño guiado por tests**. Los tests fuerzan a pensar en la API antes de la
implementación. Si un test es difícil de escribir, es señal de que el diseño es malo — eso
es "listening to tests" (Freeman & Pryce).

### Cuándo TDD NO aplica bien

- **Spikes/exploración:** cuando no sabes qué vas a construir.
- **UI exploratoria:** diseñando interacciones nuevas, prototipos visuales.
- **Código de infraestructura:** configuración de frameworks, wiring de módulos.
- **Scripts de un solo uso.**

En estos casos: escribir el código primero, luego agregar tests para el comportamiento
estabilizado.

---

## 9. Test Smells — Anti-patrones

Catálogo basado en Meszaros ("xUnit Test Patterns") y Khorikov, con el mapeo a herramientas
de detección automática verificado contra las reglas reales de cada plugin (no citadas de
memoria: `eslint-plugin-playwright` 59 reglas, `eslint-plugin-vitest` 82 reglas,
`eslint-plugin-testing-library` 29 reglas).

### Fragile Test

**Qué es:** cambiar la implementación sin cambiar el comportamiento rompe muchos tests.

**Causa raíz:** tests acoplados a detalles de implementación (estructura interna, orden de
llamadas, nombres de métodos privados).

```typescript
// FRAGILE: acoplado a la implementación interna
it('should call repository.save then eventBus.publish', () => {
  await service.createTask({ title: 'Test' });
  expect(mockRepo.save).toHaveBeenCalledBefore(mockEventBus.publish);
});

// RESILIENT: verifica el resultado observable
it('should persist task and make it retrievable', async () => {
  await service.createTask({ title: 'Test' });
  const task = await service.getTaskByTitle('Test');
  expect(task).toBeDefined();
});
```

### Slow Test

**Qué es:** tests que tardan más de lo necesario por I/O innecesario o mocks mal
configurados.

**Solución:** identificar qué hace el test lento. Si es I/O necesario (DB), es un
integration test legítimo. Si es I/O accidental (llamada HTTP real que debería ser mock),
corregir.

### Obscure Test

**Qué es:** setup de 50+ líneas donde la intención del test se pierde.

**Solución:** extraer factory functions, usar builders, nombrar datos con intención.

```typescript
// OBSCURE
it('should calculate discount', () => {
  const customer = { id: 1, name: 'Test', email: 'a@b.com', type: 'premium',
    createdAt: new Date('2020-01-01'), lastLogin: new Date(), address: {
      street: '123 Main', city: 'NYC', zip: '10001', country: 'US'
    }, preferences: { newsletter: true, darkMode: false } };
  const order = { id: 1, customerId: 1, items: [{ id: 1, productId: 1,
    quantity: 5, price: 100 }], status: 'pending', createdAt: new Date() };

  const discount = calculateDiscount(customer, order);
  expect(discount).toBe(0.15);
});

// CLEAR
it('should apply 15% discount for premium customers with orders over $400', () => {
  const premiumCustomer = createTestCustomer({ type: 'premium' });
  const largeOrder = createTestOrder({ totalAmount: 500 });

  const discount = calculateDiscount(premiumCustomer, largeOrder);

  expect(discount).toBe(0.15);
});
```

### Eager Test

**Qué es:** un test que verifica demasiados comportamientos a la vez.

**Solución:** dividir en tests individuales con un solo comportamiento cada uno.

### Mystery Guest

**Qué es:** datos de fixtures externos que el lector del test no puede ver ni entender.

```typescript
// MYSTERY GUEST: qué hay en tasks.json? Cuántos tasks hay? Qué propiedades tienen?
beforeAll(async () => {
  await loadFixture('tasks.json');
});

it('should return high priority tasks', async () => {
  const tasks = await service.findByPriority('high');
  expect(tasks).toHaveLength(3); // Por qué 3? Nadie sabe sin abrir el archivo
});

// SOLUCIÓN: datos visibles en el test
it('should return only high priority tasks', async () => {
  await taskRepo.save([
    createTestTask({ priority: 'high' }),
    createTestTask({ priority: 'low' }),
    createTestTask({ priority: 'high' }),
  ]);

  const tasks = await service.findByPriority('high');
  expect(tasks).toHaveLength(2);
});
```

### Test Logic in Production

**Qué es:** código condicional en producción que solo existe para facilitar tests.

```typescript
// DON'T: lógica de test en producción
class UserService {
  async createUser(data: CreateUserDto) {
    const user = this.repo.create(data);
    if (process.env.NODE_ENV !== 'test') {
      await this.emailService.sendWelcome(user.email);
    }
    return user;
  }
}

// DO: inyectar la dependencia y controlarla en tests
class UserService {
  constructor(
    private repo: UserRepository,
    private emailService: EmailService,
  ) {}

  async createUser(data: CreateUserDto) {
    const user = this.repo.create(data);
    await this.emailService.sendWelcome(user.email);
    return user;
  }
}
// En tests: inyectar un stub de EmailService
```

### Mocking everything (London School al extremo)

**Qué es:** mockear absolutamente todo, incluyendo value objects y lógica pura.

**Problema:** los tests no verifican que las piezas funcionan juntas. Puedes tener 100% de
tests pasando y la app rota.

**Regla:** solo mockear boundaries de I/O. Lógica pura y value objects se usan reales.

### Testing implementation details

**Qué es un implementation detail:** cualquier cosa que el usuario/consumidor del código
**no puede observar directamente** — que internamente se usa un Map, que se llama a un
método privado `_normalize`, en qué orden se ejecutan los pasos internos.

**Observable behavior**, en cambio: el output de una función, el estado visible después de
una acción, side effects observables (email enviado, registro en DB, evento publicado).

### Copy-paste tests (DRY en tests)

**Regla:** en tests, **la claridad gana sobre DRY**. Algo de duplicación es preferible a
abstracciones que oscurecen la intención.

```typescript
// ACCEPTABLE: duplicación que mantiene claridad
it('should reject order when stock is zero', () => {
  const order = createTestOrder({ productId: 'ABC', quantity: 1 });
  setStock('ABC', 0);
  expect(() => processOrder(order)).toThrow('Insufficient stock');
});

it('should reject order when requested quantity exceeds stock', () => {
  const order = createTestOrder({ productId: 'ABC', quantity: 10 });
  setStock('ABC', 5);
  expect(() => processOrder(order)).toThrow('Insufficient stock');
});

// OVER-DRY: abstracción que oscurece
it.each([
  [0, 1], [5, 10], [3, 4],
])('stock=%i, qty=%i should throw', (stock, qty) => {
  // Ya no se entiende la intención de cada caso
});
```

**Cuándo sí aplicar DRY en tests:** factory functions (`createTestUser`), setup helpers
(`setupTestDb`), y assertions custom (`expectValidationError`). Estas extracciones **ayudan**
a la claridad.

### Tabla resumen — antipatrón, causa y detección

| Antipatrón | Por qué falla | Cómo se detecta |
|---|---|---|
| Test espeja la implementación | Se rompe con cualquier refactor aunque el comportamiento no cambie; falsa cobertura | Revisión manual; `testing-library/no-container` ataca el caso de acceder al DOM interno del render |
| Mocks de todo (over-mocking) | El test verifica que los mocks se llamaron, no que el sistema funciona | Revisión manual — heurística: si un integration test no toca ningún colaborador real, sospechar |
| Snapshot testing abusivo | Un snapshot que cambia con cualquier diff de HTML se actualiza en automático sin revisión — dejó de ser un assert | Buscar `toMatchSnapshot` fuera de regresión visual deliberada |
| Test que pasa con el bug presente | No prueba nada — la suite en verde miente | Mutation testing (Stryker) — un mutante sobreviviente en esa línea es la prueba directa |
| `expect(true).toBe(true)` encubierto | Cero valor, ocupa tiempo de CI | `vitest/expect-expect` detecta *ausencia* de expect; el caso de expect trivial sobre constante requiere revisión manual (ver §11, no automatizable de forma precisa) |
| Tests acoplados al orden de ejecución | Pasan en CI y fallan en local (o viceversa); síntoma de estado compartido | Correr con `--shuffle` / orden aleatorio como gate en CI |
| Esperas fijas (`sleep`, `waitForTimeout`) | Flakiness directa — causa individual más común (~45% según benchmarks 2026) | `playwright/no-wait-for-timeout` |
| Selectores frágiles (CSS anidado, XPath, clases) | Se rompen con cualquier cambio de maquetación sin cambio de comportamiento | `playwright/no-raw-locators`; `testing-library/prefer-screen-queries` |
| `await` faltante en assert async | El test "pasa" sin haber esperado el resultado real — falso positivo silencioso, el más peligroso porque no lanza error | `playwright/missing-playwright-await`; `testing-library/await-async-utils`, `await-async-queries`; `vitest/valid-expect` |
| Test que no falla nunca (siempre verde, incluso mutado) | Deuda de falsa confianza — agravada por generación con IA (ver §2) | Score de mutación con Stryker; break threshold en CI |
| `.only` / `.skip` / `fit` / `fdescribe` commiteado | Excluye tests silenciosamente del run — cobertura reportada miente | `playwright/no-focused-test`, `vitest/no-focused-tests` para `.only`; `vitest/no-disabled-tests`, `playwright/no-skipped-test` para `.skip` |
| Datos de prueba creados por UI en vez de API/seed | Cada test tarda mucho más navegando un formulario de setup que no es lo que se prueba; acopla el test a un flujo ajeno | Revisión manual — sin lint automatizado |

---

## 10. Diseño para testabilidad

### Dependency Injection

El patrón más importante para testabilidad. Si una clase crea sus propias dependencias, no
puedes reemplazarlas en tests.

```typescript
// DON'T: dependencia hardcodeada
class OrderService {
  private emailService = new EmailService(); // No puedes reemplazar en tests

  async createOrder(data: CreateOrderDto) {
    await this.emailService.sendConfirmation(data.email);
  }
}

// DO: inyectar dependencia
class OrderService {
  constructor(private emailService: EmailService) {}

  async createOrder(data: CreateOrderDto) {
    await this.emailService.sendConfirmation(data.email);
  }
}
// En NestJS esto es automático con el sistema de módulos
```

### Pure functions: las más fáciles de testear

Sin side effects, sin dependencias, sin estado. Input → Output. Siempre deterministas.

```typescript
// PURA: trivial de testear
function calculateTax(amount: number, rate: number): number {
  return amount * rate;
}

// IMPURA: requiere mock de Date y DB
async function calculateLateFee(invoiceId: string): Promise<number> {
  const invoice = await db.findInvoice(invoiceId);
  const daysLate = differenceInDays(new Date(), invoice.dueDate);
  return daysLate > 0 ? daysLate * 5 : 0;
}

// REFACTORED: separar la lógica pura
function calculateLateFeeAmount(daysLate: number, dailyRate: number): number {
  return daysLate > 0 ? daysLate * dailyRate : 0;
}
// Ahora la lógica pura es trivial de testear
// El wiring con DB y Date queda en el shell imperativo
```

### Functional Core, Imperative Shell (Gary Bernhardt)

Patrón arquitectónico que maximiza la testabilidad:

- **Functional Core:** toda la lógica de negocio en funciones puras. Se testea con unit
  tests simples y rápidos, sin mocks.
- **Imperative Shell:** capa delgada que maneja I/O (DB, HTTP, filesystem). Conecta las
  funciones puras con el mundo exterior. Se testea con pocos integration tests.

```typescript
// FUNCTIONAL CORE — lógica pura, fácil de testear
function determineOrderStatus(
  items: OrderItem[],
  inventory: Map<string, number>,
): OrderValidationResult {
  const insufficientStock = items.filter(
    item => (inventory.get(item.productId) ?? 0) < item.quantity
  );

  if (insufficientStock.length > 0) {
    return { valid: false, reason: 'insufficient_stock', items: insufficientStock };
  }

  return { valid: true, totalAmount: items.reduce((sum, i) => sum + i.price * i.quantity, 0) };
}

// IMPERATIVE SHELL — I/O, pocos tests de integración
async function processOrder(orderId: string): Promise<void> {
  const order = await orderRepo.findById(orderId);
  const inventory = await inventoryService.getStockLevels(order.items.map(i => i.productId));

  const result = determineOrderStatus(order.items, inventory); // Functional core

  if (result.valid) {
    await orderRepo.updateStatus(orderId, 'confirmed');
    await paymentService.charge(order.customerId, result.totalAmount);
  } else {
    await orderRepo.updateStatus(orderId, 'rejected');
    await notificationService.notifyInsufficientStock(order.customerId, result.items);
  }
}
```

### Código legacy sin tests: encontrar seams

Un **seam** (Michael Feathers, "Working Effectively with Legacy Code") es un punto donde
puedes alterar el comportamiento sin modificar el código:

1. **Extraer interfaz:** de una clase concreta, extraer una interfaz e inyectarla.
2. **Extraer método:** mover lógica a un método que puedas override en un subclass de test.
3. **Parametrizar constructor:** agregar un parámetro con default que permita inyectar en
   tests.

```typescript
// LEGACY: todo acoplado
class ReportGenerator {
  generate() {
    const data = database.query('SELECT * FROM sales');
    const formatted = this.format(data);
    fs.writeFileSync('/reports/sales.csv', formatted);
  }
}

// STEP 1: extraer seams
class ReportGenerator {
  constructor(
    private dataSource: DataSource = database,           // Seam 1
    private outputWriter: OutputWriter = new FileWriter() // Seam 2
  ) {}

  generate() {
    const data = this.dataSource.query('SELECT * FROM sales');
    const formatted = this.format(data);
    this.outputWriter.write('/reports/sales.csv', formatted);
  }
}
// Ahora puedes inyectar fakes en tests
```

---

## 11. Vue/Nuxt Testing específico

### Qué testear en componentes Vue

| Testear | No testear |
|---|---|
| Texto renderizado visible al usuario | Nombres de clases CSS |
| Elementos visibles/ocultos por condición | Estructura interna del DOM |
| Resultado de interacciones (click, input) | Lifecycle hooks internos |
| Props que afectan el render | State interno del componente |
| Eventos emitidos al padre | Implementación de watchers |
| Slots renderizados correctamente | Métodos de instancia privados |

### vue-test-utils: patrones

```typescript
import { mount, shallowMount } from '@vue/test-utils';

// Mounting con props
const wrapper = mount(TaskCard, {
  props: {
    task: { id: '1', title: 'Test', status: 'pending' },
  },
});

// Verificar texto renderizado
expect(wrapper.text()).toContain('Test');

// Verificar visibilidad condicional
expect(wrapper.find('[data-id="completed-badge"]').exists()).toBe(false);

// Simular interacción
await wrapper.find('[data-id="complete-button"]').trigger('click');

// Verificar evento emitido
expect(wrapper.emitted('complete')).toHaveLength(1);
expect(wrapper.emitted('complete')![0]).toEqual(['1']);

// Verificar slot
const wrapper = mount(Card, {
  slots: {
    default: '<p>Card content</p>',
    footer: '<button>Save</button>',
  },
});
expect(wrapper.text()).toContain('Card content');
```

### Composables: testing en aislamiento

```typescript
import { ref } from 'vue';
import { useTaskFilter } from './useTaskFilter';

// Composables puros (sin lifecycle hooks): testear directamente
it('should filter tasks by status', () => {
  const tasks = ref([
    { id: '1', title: 'A', status: 'done' },
    { id: '2', title: 'B', status: 'pending' },
  ]);

  const { filteredTasks, setFilter } = useTaskFilter(tasks);

  setFilter('pending');

  expect(filteredTasks.value).toHaveLength(1);
  expect(filteredTasks.value[0].title).toBe('B');
});

// Composables con lifecycle hooks: montar en componente wrapper
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

it('should fetch data on mount', async () => {
  const TestWrapper = defineComponent({
    setup() {
      const { data, loading } = useFetchTasks();
      return { data, loading };
    },
    template: '<div>{{ loading ? "loading" : data?.length }}</div>',
  });

  const wrapper = mount(TestWrapper);
  // ...assertions
});
```

### Pinia stores: testing

```typescript
import { setActivePinia, createPinia } from 'pinia';
import { useTaskStore } from './taskStore';

beforeEach(() => {
  setActivePinia(createPinia());
});

it('should add task and update count', () => {
  const store = useTaskStore();

  store.addTask({ title: 'New task', priority: 'high' });

  expect(store.tasks).toHaveLength(1);
  expect(store.taskCount).toBe(1);
});

// Con createTestingPinia para componentes
import { createTestingPinia } from '@pinia/testing';

const wrapper = mount(TaskDashboard, {
  global: {
    plugins: [createTestingPinia({
      initialState: {
        tasks: { items: mockTasks },
      },
      stubActions: false, // Ejecutar acciones reales
    })],
  },
});
```

### Async components y Suspense

```typescript
import { mount, flushPromises } from '@vue/test-utils';
import { Suspense } from 'vue';
import AsyncTaskList from './AsyncTaskList.vue';

it('should render async component after data loads', async () => {
  const wrapper = mount({
    template: `
      <Suspense>
        <AsyncTaskList />
      </Suspense>
    `,
    components: { AsyncTaskList },
  });

  // Esperar a que se resuelvan las promesas
  await flushPromises();

  expect(wrapper.findAll('[data-id="task-item"]')).toHaveLength(3);
});
```

---

## 12. Estructura de archivos y convención de nombres

Convención de referencia para Vue/Nuxt + Vitest + Playwright (adaptar al stack real del
proyecto):

```
src/
  components/
    UserCard/
      UserCard.vue
      UserCard.spec.ts        # integración: monta el componente real, MSW en el borde de red
  composables/
    useCartTotal.ts
    useCartTotal.spec.ts       # unit: lógica de dominio aislada, sin red ni DOM
server/
  api/
    orders.post.ts
    orders.post.spec.ts        # integración de servidor: Supertest o equivalente, sin navegador
e2e/
  auth.spec.ts                 # flujo crítico completo: login
  checkout.spec.ts             # flujo crítico completo: compra
  fixtures/
    auth.fixture.ts            # test.extend con storageState
  support/
    seed.ts                    # creación de datos vía API, no vía UI
playwright.config.ts
vitest.config.ts
```

Reglas de la convención:
- **`*.spec.ts` junto al archivo que prueba**, para unit/integración de componentes y
  composables — ubicación predecible, se encuentra sin buscar.
- **`e2e/` como carpeta de nivel raíz, separada del código fuente** — señala explícitamente
  "esto es lento, corre distinto, no se ejecuta en cada guardado".
- **Nombre de archivo E2E describe el flujo de negocio, no la pantalla**
  (`checkout.spec.ts`, no `cart-page.spec.ts`) — refuerza que E2E cubre journeys, no
  pantallas sueltas.
- **`describe` de nivel superior = el comportamiento o componente; `test`/`it` = un caso
  concreto.** Sin anidar un tercer nivel salvo variantes genuinas (ej. roles de usuario
  distintos).
- **Fixtures y datos de seed viven fuera de los archivos de test**, en `support/` o
  `fixtures/`, para que el test en sí quede corto y legible.

---

## 13. Testing de Seguridad

Para detalles completos de testing de vulnerabilidades (DAST, SAST, OWASP ZAP, dependency
scanning), ver skill `owasp-security` / `security-master`.

Target: 90% de cobertura (9/10 amenazas mitigadas). Cada test sigue el patrón AAA.

| # | Amenaza | Qué testear |
|---|--------|-------------|
| A01 | Broken Access Control | RLS bypass, escalación de privilegios, acceso directo a objetos |
| A02 | Cryptographic Failures | Encriptación de tokens, hashing de contraseñas, HTTPS forzado |
| A03 | Injection | SQL injection, XSS, command injection |
| A04 | Insecure Design | Rate limiting, detección de anomalías, casos de abuso |
| A05 | Security Misconfiguration | Errores verbosos, credenciales por defecto, endpoints expuestos |
| A07 | Auth Failures | Session hijacking, CSRF, fuerza bruta |
| A08 | Data Integrity | Datos sin firmar/verificar, supply chain |
| A09 | Logging Failures | Falta de audit trail, alertas insuficientes |
| A10 | SSRF | Server-side request forgery contra servicios internos |

**Chequeo de seguridad antes de cualquier PR que toque backend o API:**
- [ ] No hay secretos hardcodeados en el código nuevo.
- [ ] Todos los inputs se validan antes de procesar.
- [ ] Las respuestas de error no exponen internals del servidor.
- [ ] Los endpoints nuevos tienen autenticación si el proyecto la requiere.

En el contexto de tests (no auditoría completa):
- Los tests de seguridad no reemplazan auditorías, pero sí previenen regresiones.
- Testear: autenticación, autorización (roles/permisos), sanitización de inputs, rate
  limiting.
- Herramientas: tests de integración con Supertest para endpoints protegidos, Playwright
  para flujos de auth en E2E.

---

## 14. CI/CD y Testing

### Cuándo correr cada tipo de test

| Evento | Tests a ejecutar |
|---|---|
| Pre-commit (local) | Static analysis (lint, typecheck) |
| Push / PR | Unit + Integration + Stryker en modo incremental (solo archivos cambiados) |
| Merge a main/develop | Unit + Integration + E2E (con sharding) |
| Nightly / scheduled | E2E completo + mutation testing full + visual regression |
| Pre-deploy | Smoke tests (subset de E2E críticos) + smoke de arranque real (ver §15) |

Artefactos de fallo siempre adjuntos en CI: trace, video, screenshot — sin esto, un fallo en
CI es indebuggeable a distancia.

### Paralelización

- **Unit tests:** paralelizar agresivamente. Sin estado compartido, sin orden.
- **Integration tests:** paralelizar con aislamiento de DB (schema por worker, o
  transacciones con rollback).
- **E2E tests:** paralelizar con cuidado. Cada worker necesita su propia sesión de usuario y
  datos.

En Vitest:
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    pool: 'forks',           // Aislamiento por proceso
    poolOptions: {
      forks: {
        minForks: 2,
        maxForks: 4,
      },
    },
  },
});
```

En Playwright:
```typescript
// playwright.config.ts
export default defineConfig({
  workers: process.env.CI ? 2 : undefined,
  fullyParallel: true,
});
```

### Reporting: métricas a exponer

- **Tasa de pass/fail:** tendencia, no solo el último run.
- **Tiempo de ejecución:** por tipo de test. Detectar degradación.
- **Flaky tests:** identificar y corregir. Un test flaky debe arreglarse o eliminarse, nunca
  ignorarse.
- **Cobertura:** como indicador de tendencia, no como gate bloqueante.

---

## 15. Bug Tracking

### Campos obligatorios del reporte de bug

- **ID**: secuencial `BUG-001`, `BUG-002`, ...
- **Severidad**: P0-P4 (ver tabla de prioridades abajo)
- **Título**: descripción de una línea del comportamiento observado
- **Pasos para reproducir**: numerados, específicos, reproducibles
- **Esperado vs Actual**: delta claro
- **Entorno**: OS, browser, versiones, configuración
- **Test vinculado**: TC-ID que lo detectó (si aplica)

### Ciclo de vida del bug

```
Open → In Progress → Fixed → Verified → Closed
                           ↘ Reopened (si la verificación falla)
```

### Priority Levels

| Priority | Name | Example | SLA to fix |
|----------|------|---------|-----------|
| P0 | Blocker | Vuln de seguridad, pérdida de datos, flujo core roto | 24h |
| P1 | Critical | Feature mayor rota, sin workaround | 48h |
| P2 | High | Feature menor rota, existe workaround | Sprint |
| P3 | Medium | Issue cosmético o de UX | Backlog |
| P4 | Low | Typo de documentación | Optional |

---

## 16. Quality Gates

Todos los gates deben pasar antes de un release. Calcular con:
```bash
python scripts/calculate_metrics.py <TEST-EXECUTION-TRACKING.csv>
```

| Gate | Target | Release blocker |
|------|--------|----------------|
| Test execution | 100% | Yes |
| Pass rate | ≥ 80% | Yes |
| P0 bugs open | 0 | Yes |
| P1 bugs open | ≤ 5 | Yes |
| Code coverage | ≥ 80% | Yes |
| OWASP coverage | ≥ 90% (9/10 amenazas) | Yes |
| Mutation score | Según umbral del proyecto (`thresholds.break`) | En release |

### Project Scale Guide

| Project size | Tests | Timeline | Daily velocity |
|-------------|-------|----------|---------------|
| Small | ~50 | 2 weeks | 5-7 tests/day |
| Medium | ~200 | 4 weeks | 10-12 tests/day |
| Large | 500+ | 8-10 weeks | 10-15 tests/day |

---

## 17. QA Infrastructure Setup

### One-command initialization

```bash
python scripts/init_qa_project.py <project-name> [output-directory]
```

Crea:
- `tests/docs/`, `tests/e2e/`, `tests/fixtures/`
- `TEST-EXECUTION-TRACKING.csv`, `BUG-TRACKING-TEMPLATE.csv`
- `BASELINE-METRICS.md`, `WEEKLY-PROGRESS-REPORT.md`
- Master QA prompt para ejecución autónoma por LLM

### Ground Truth Principle (crítico)

- **Documentos de casos de prueba** (p. ej. `02-AUTH-TEST-CASES.md`) = fuente autoritativa
  de los pasos.
- **CSV de tracking** = solo estado de ejecución.
- Nunca confiar en el CSV para saber qué *debería* hacer un test — siempre leer primero el
  documento del caso de prueba.

### Reporting cadence

| Report | Trigger | Contents |
|--------|---------|---------|
| Daily summary | Fin del día | Tests corridos, pass rate, bugs abiertos, bloqueos, plan de mañana |
| Weekly report | Viernes | Comparación vs baseline, estado de quality gates, tendencias |
| Release report | Pre-release | Todos los gates, bugs abiertos por severidad, sign-off |

---

## 18. Checklist antes de hacer PR

### Tests existentes
- [ ] Todos los tests pasan localmente (`vitest run`, `playwright test`).
- [ ] No hay tests deshabilitados (`.skip`, `.only`) que no deberían estar.
- [ ] No se rompió ningún test existente por cambios en la implementación.

### Tests nuevos/modificados
- [ ] Cada comportamiento nuevo tiene al menos un test.
- [ ] Los tests siguen AAA (Arrange-Act-Assert).
- [ ] Los nombres de tests son descriptivos (`should [behavior] when [condition]`).
- [ ] No se testean detalles de implementación.
- [ ] Los tests son deterministas (no dependen de tiempo, random, estado global).
- [ ] Los tests son independientes (pueden correr en cualquier orden).
- [ ] No hay `waitForTimeout()` ni sleeps hardcodeados.
- [ ] Los datos de test son visibles en el test (no Mystery Guest).

### Test doubles
- [ ] Solo se mockean boundaries de I/O (DB, HTTP, filesystem).
- [ ] No se mockea lógica pura ni value objects.
- [ ] Los mocks/stubs se limpian en `afterEach` (`vi.restoreAllMocks()`).

### Tipo de test correcto
- [ ] Lógica pura → unit test.
- [ ] Módulo + dependencias reales → integration test.
- [ ] Flujo completo del usuario → E2E test.
- [ ] No se usa E2E para testear lógica que un unit test cubriría mejor.
- [ ] No se usa unit test donde un integration test daría más confianza.

---

## 19. Protocolo de verificación pre-commit (obligatorio)

Correr esta checklist antes de marcar cualquier tarea como terminada o abrir un PR.
**Orden: más rápido → más lento. Parar y arreglar antes de continuar.**

### Paso 1 — Detectar scripts disponibles

```bash
cat package.json | grep -E '"scripts"' -A 30
```

Correr solo los checks que existan en el proyecto. Adaptar al stack real.

### Paso 2 — Ejecutar en orden

#### 2a. Lint (segundos — primero)
```bash
npm run lint
# o si no hay script:
npx eslint . --ext .ts,.vue --max-warnings 0
```
Criterio: cero errores. Los warnings nuevos del cambio actual deben corregirse.

#### 2b. Types (segundos a minutos — antes del build)
```bash
# Nuxt
npx nuxi typecheck

# Vue + Vite / NestJS / Node
npx tsc --noEmit
```
Criterio: cero errores de tipos. Warnings preexistentes aceptables solo si no los introdujo
el cambio actual.

#### 2c. Tests (variable — solo si lint + types pasan)
```bash
# Vitest
npx vitest run

# Jest
npx jest --passWithNoTests

# Playwright — solo si el cambio toca flujos completos de usuario
npx playwright test --reporter=line
```
Criterio: todos los tests pasan. Reportar qué test falló y por qué si alguno falla.

#### 2d. Build (último — solo si todo lo anterior pasó)
```bash
# Nuxt
npx nuxi build

# Vite
npx vite build

# NestJS
npm run build
```
Criterio: el build termina sin errores.

### Paso 3 — Revisión del diff

```bash
git diff --stat
git diff
```

Verificar:
- [ ] No hay archivos de debug ni `console.log` sin intención incluidos.
- [ ] No hay `TODO` / `FIXME` nuevos sin entrada en `.ai/`.
- [ ] Los cambios coinciden exactamente con el alcance de la tarea.

### Paso 4 — Reporte de verificación

Emitir esto antes de declarar la tarea terminada:

```
## Verification Result

| Check      | Status              | Detail                        |
|------------|---------------------|-------------------------------|
| Lint       | ✅ / ❌             | ...                           |
| Types      | ✅ / ❌             | ...                           |
| Tests      | ✅ / ❌ / ⏭ skipped | N tests, N passed             |
| Build      | ✅ / ❌ / ⏭ skipped | ...                           |
| Security   | ✅ / ⚠ manual       | ...                           |
| Diff       | ✅ / ⚠              | ...                           |

**Conclusion:** ready to commit / N issues to resolve first
```

### Qué NO hacer en verificación

- No saltear un paso que falla para "seguir avanzando".
- No correr comandos destructivos (`drop`, `reset --hard`, etc.).
- No modificar código para forzar que un test pase sin entender por qué falló.

---

## 20. Verificación y Checkpoints de cierre

<!-- fusionado desde la skill verification-checkpoints -->

> Regla de oro: **el agente no dice "funciona", lo demuestra.** Toda tarea termina con
> evidencia ejecutable, no con afirmaciones.
> En sistemas multi-agente no se evalúa el camino, se evalúa el destino.

Agnóstico de tecnología: los comandos concretos los define cada proyecto en su `AGENTS.md` /
`.ai/rules/`. Aquí va el protocolo.

### Comando de verificación del proyecto

Cada proyecto define UN comando único que deja todo verde o rojo. Ejemplos según stack:

- Si hay Makefile → `make test` (preferir targets del Makefile sobre llamadas directas).
- Node → `npm test` / `npm run verify`.
- Python → `pytest` / `python -m unittest discover`.
- Genérico → un `verify.sh` / `init.sh` que corre lint + tests y termina con exit code 0.

El revisor corre ese comando. **No aprueba nada con el comando en rojo.** El especialista lo
corre antes de pedir revisión.

**El comando de verificación DEBE incluir el schema-check del catálogo**
(`.ai/feature_list.json`) como parte del estado sano, además de los tests. El schema-check
rechaza (exit code `!= 0`):
- más de una feature en `in_progress` a la vez,
- un `status` fuera del enum `valid_status`.

Diferencia clave de costo: la suite de **tests es bajo demanda** (según la doctrina —
unitarios para lo que se toca, E2E cuando se pide; nunca automáticos tras cada edición). El
**schema-check, en cambio, es instantáneo y siempre corre**: solo lee el JSON, no ejecuta
tests. Snippet de referencia en `@rules/feature-list.md`.

### Niveles de verificación

1. **Unitario (obligatorio):** toda unidad pública tocada tiene test que cubre camino feliz
   + al menos un camino de error. Verifica el resultado concreto, no solo "no lanza
   excepción".
2. **Integración (si aplica):** features de interfaz/CLI/API se prueban end-to-end contra
   recursos reales temporales, no contra mocks del entorno.
3. **Smoke manual (recomendado):** un flujo end-to-end real antes de cerrar.

### Anti-patrones

- ❌ "Lo implementé, debería funcionar." → falta evidencia ejecutable.
- ❌ Test que solo verifica que no explota → debe comprobar el resultado.
- ❌ Mockear el filesystem/entorno cuando se puede usar un recurso temporal real.
- ❌ Marcar `done` sin el comando de verificación en verde.

### Dos capas de validación

El revisor valida contra DOS cosas, en este orden:

1. **`asserts.md` de la tarea** (`.ai/features/<f>/tasks/<id>/asserts.md`) — el contrato
   específico de ESTA tarea (lo genera el brief). Criterios verificables propios de la
   tarea.
2. **CHECKPOINTS genéricos C1-C5** — el estado sano del proyecto, igual para toda feature.

No aprueba si queda algún `[ ]` en cualquiera de las dos capas.

### asserts.md — contrato de aceptación por tarea

El `@brief` SIEMPRE genera `.ai/features/<feature>/tasks/<id>/asserts.md`. Es el documento
de "qué debe cumplir el especialista", marcable por el revisor. Toda tarea tiene el suyo,
sub-agrupado en su carpeta `tasks/<id>/`.

```markdown
# Asserts — tarea: <id-slug> (feature: <nombre>)
> Contrato generado por @brief. El especialista lo cumple, el revisor lo recorre.

### Criterios de aceptación
- [ ] <verificable: "el endpoint devuelve 404 si el id no existe">
- [ ] <verificable: "el componente renderiza el spinner mientras carga">
- [ ] <cada criterio tiene su test asociado>

### Cómo se verifica
- <comando o flujo concreto por criterio>
```

Reglas:
- Cada assert debe ser **verificable**, no vago. "Devuelve 404 si no existe", no "maneja
  bien errores".
- El especialista recibe `asserts.md` como parte del context package y lo trata como
  contrato.
- El revisor marca `[x]` solo lo que verificó con evidencia (0-Trust). Un `[ ]` = no se
  aprueba.
- Los asserts salen del `acceptance` de la feature en `.ai/feature_list.json` y los afina el
  brief.

### CHECKPOINTS — criterios objetivos de estado final

El revisor recorre esta checklist, marca `[x]`/`[ ]`, y **rechaza el cierre si queda algún
box vacío**. Plantilla base (cada proyecto la afina en `.ai/`):

```markdown
### C1 — El arnés está completo
- [ ] AGENTS.md, .ai/todos.md, .ai/rules/ y comando de verificación existen.
- [ ] El comando de verificación termina con exit code 0.

### C2 — El estado es coherente
- [ ] Como mucho una feature en in_progress.
- [ ] Toda feature done tiene tests asociados que pasan.
- [ ] .ai/features/<f>/estado.md describe la sesión activa, sin basura previa.

### C3 — El código respeta la arquitectura
- [ ] Solo los módulos previstos; sin dependencias no aprobadas.
- [ ] Sin debug suelto (prints, logs temporales) ni TODOs sin contexto.

### C4 — La verificación es real
- [ ] Al menos un test por unidad nueva/modificada.
- [ ] Los tests usan recursos temporales reales, no mocks del entorno.
- [ ] El comando de verificación muestra >0 tests y todos verdes.

### C5 — La sesión se cerró bien
- [ ] Sin archivos basura sin trackear.
- [ ] .ai/todos.md y estado de la feature reflejan la realidad.
```

### Formato del veredicto del revisor

Output escrito en `.ai/features/<feature>/tasks/<id>/review.md`:

```markdown
# Review — tarea <id-slug> (feature: <nombre>)
**Veredicto:** APPROVED | CHANGES_REQUESTED

### Checkpoints
- C1: [x]
- C2: [x]
- C3: [ ]  ← Razón: src/x.py importa dependencia no aprobada (línea N)
- C4: [x]
- C5: [x]

### Cambios requeridos (si aplica)
1. <concreto, citando archivo y línea>
```

Respuesta al orquestador: una sola línea — `APPROVED -> .ai/features/<f>/tasks/<id>/review.md`
o `CHANGES_REQUESTED -> .ai/features/<f>/tasks/<id>/review.md`.

### Reglas duras del revisor

- Nunca aprobar con verificación en rojo o checkpoints vacíos.
- Nunca editar el código del especialista — decir qué falla, no arreglarlo.
- Feedback concreto: citar archivo y línea. Nada genérico.

---

## 21. Lo que NO se puede automatizar

Lo que exige juicio humano no entra en un gate automático (regla dura: precisión sobre
cobertura — un verificador con falsos positivos termina desactivado):

- **Si el mock de MSW representa fielmente el contrato real del backend.** Un contract test
  (Fowler, "ContractTest") corrido periódicamente contra el servicio real es la única
  defensa real, y sigue siendo trabajo de definir el contrato, no algo que un lint verifique.
- **Si un test de integración realmente prueba el comportamiento que su nombre promete**,
  más allá de tener `expect` y no ser trivial — la calidad semántica de la aserción requiere
  juicio humano o, como mucho, revisión asistida por IA con supervisión, nunca un gate ciego.
- **Si el conjunto de flujos cubiertos por E2E son los que realmente importan al negocio** —
  decisión de producto/dominio, no derivable del código.
- **Si un `.skip` documentado con ticket sigue siendo válido** o ya se volvió deuda
  olvidada — requiere revisión periódica, no un bloqueo automático.
- **La causa raíz de un test flaky no estructural** (p. ej. una condición de carrera real en
  el backend que el test expone correctamente) — el gate puede señalar que algo es flaky,
  pero diagnosticar si el test tiene la culpa o el sistema bajo prueba es investigación
  humana.
- **`expect(true).toBe(true)` disfrazado de assert real** (assertion trivial sobre un valor
  constante): ningún plugin de lint investigado distingue "literal constante" de "valor
  derivado que en este caso es constante" — requiere análisis semántico, no sintáctico. Un
  regex/AST ingenuo genera falsos positivos sobre casos legítimos (tests de tipos, valores
  de configuración esperados); no se agrega como gate automático.
- **Que exista un smoke test de arranque real** puede detectarse por ausencia, pero *que
  cubra la ruta representativa correcta* de la aplicación es una decisión de dominio.

---

## Referencias

### Libros
- **Osherove, Roy & Khorikov, Vladimir.** "The Art of Unit Testing, 3rd Edition." Manning,
  2024. — Definición de unit test, test doubles, diseño testeable. Ejemplos en
  JavaScript/TypeScript.
- **Khorikov, Vladimir.** "Unit Testing: Principles, Practices, and Patterns." Manning,
  2020. — Cuatro pilares, output-based testing, London vs Detroit school.
- **Beck, Kent.** "Test-Driven Development: By Example." Addison-Wesley, 2003. —
  Red-green-refactor, triangulación, baby steps.
- **Meszaros, Gerard.** "xUnit Test Patterns: Refactoring Test Code." Addison-Wesley, 2007.
  — Catálogo de 68 patrones, test smells, taxonomía de test doubles.
- **Freeman, Steve & Pryce, Nat.** "Growing Object-Oriented Software, Guided by Tests."
  Addison-Wesley, 2010. — Outside-in TDD, acceptance tests, listening to tests.
- **Winters, Titus; Manshreck, Tom; Tamplin, Hyrum.** "Software Engineering at Google."
  O'Reilly, 2020. — Modelo de tamaños small/medium/large, hermeticidad, Beyoncé Rule (cap.
  11 y 14).

### Artículos y talks
- **Dodds, Kent C.** "Write tests. Not too many. Mostly integration." — Testing Trophy, ROI
  de integration tests.
- **Dodds, Kent C.** "The Testing Trophy and Testing Classifications." — Definición formal
  del trophy.
- **Dodds, Kent C.** "Common Mistakes with React Testing Library." — Antipatrones de
  testing de componentes.
- **Dodds, Kent C.** "Avoid Nesting when you're Testing." — Por qué `describe` anidado y
  `beforeEach` compartido rompen legibilidad y aislamiento.
- **Fowler, Martin.** "Mocks Aren't Stubs." — Taxonomía de test doubles, state vs behavior
  verification.
- **Fowler, Martin.** "TestDouble." — Término genérico para objetos de test (Meszaros).
- **Fowler, Martin.** "The Practical Test Pyramid" (Ham Vocke). — Estructura de capas, AAA,
  test doubles, regla "empujar hacia abajo".
- **Fowler, Martin.** "Eradicating Non-Determinism in Tests." — Las 5 causas de flakiness y
  cómo eliminarlas (no cuarentena como solución final).
- **Fowler, Martin.** "ContractTest" (bliki). — Contract tests y consumer-driven contracts
  para evitar desincronización FE/BE sin integración completa.
- **Google Testing Blog.** "Just Say No to More End-to-End Tests" (Mike Wacker, 2015). —
  Objeción canónica al E2E: velocidad, flakiness, debugging, ownership difuso, costo.
- **Google Testing Blog.** "Testing on the Toilet: What Makes a Good End-to-End Test"
  (2016). — Menos sistemas involucrados = más rápido, confiable, barato de mantener.
- **Testing Library.** "Guiding Principles." — "The more your tests resemble the way your
  software is used, the more confidence they can give you."
- **Testing Library.** "About Queries" (Priority). — Orden `getByRole` >
  `getByLabelText` > `getByPlaceholderText` > `getByText` > `getByDisplayValue` >
  `getByAltText` > `getByTitle` > `getByTestId`.
- **Goldberg, Yoni.** "JavaScript Testing Best Practices." GitHub. — Guía exhaustiva para
  Node.js/JS.
- **Goldberg, Yoni.** "Node.js Testing Best Practices." GitHub. — Beyond basics, con app de
  ejemplo.
- **Searls, Justin.** "Please Don't Mock Me." JSConf US 2018. — 9 abusos de mocks, workflow
  correcto.
- **Bernhardt, Gary.** "Functional Core, Imperative Shell." Destroy All Software. —
  Separación I/O y lógica.
- **ISTQB.** "Foundation Level — Seven Testing Principles." — Principios fundamentales de
  testing.
- **ACM OOPSLA.** "A large-scale longitudinal study of flaky tests" (2020). — 16% de tests
  en Google exhiben flakiness; 84% de transiciones pass→fail en post-submit son flaky.
- **arXiv 2511.16858** (nov. 2026). "Investigating Test Overfitting on SWE-bench." — Test
  overfitting en sistemas basados en LLM: pasan tests observados, fallan hidden tests.

### Herramientas y plugins verificados
- **Playwright docs oficiales** (`playwright.dev`). — Fixtures (test-scoped y
  worker-scoped), storageState, trace viewer, aislamiento por test.
- **Stryker Mutator** (`@stryker-mutator/core`). — Mutation testing con soporte nativo
  Vitest desde v7; modo `--incremental` para PR, full run nightly.
- **MSW (Mock Service Worker).** "Why Mock Service Worker." — Interceptar en el borde de
  red vs mockear módulos/clientes HTTP.
- **eslint-plugin-playwright** (`playwright-community`, 59 reglas). — `no-wait-for-timeout`,
  `missing-playwright-await`, `no-focused-test`, `no-skipped-test`, `no-raw-locators`,
  `expect-expect`, `prefer-web-first-assertions`.
- **eslint-plugin-testing-library** (org oficial `testing-library`, 29 reglas). —
  `await-async-utils`, `await-async-queries`, `no-container`, `no-node-access`,
  `prefer-screen-queries`.
- **eslint-plugin-vitest** (org oficial `vitest-dev`, 82 reglas). — `expect-expect`,
  `no-disabled-tests`, `no-focused-tests`, `valid-expect`.
