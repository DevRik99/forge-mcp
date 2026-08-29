---
name: code-quality-master
description: Unified clean-code + DRY enforcement. Use when writing, reviewing, or refactoring any code. Covers naming, functions, abstraction, duplication detection, error handling, and 2025 TypeScript/JS patterns. Supersedes individual clean-code and dry-principle skills.
user-invocable: true
allowed-tools: [Read, Write, Edit, Grep, Glob]
paths: '**/*.{ts,tsx,js,jsx,py,go,java,cs,rb}'
---

# Code Quality Master

Unified enforcement of Clean Code (Martin) + DRY principles with 2025 best practices. Apply when writing, reviewing, or refactoring code in any language.

## Core Philosophy

Code is clean if it can be read and enhanced by a developer other than its original author.
DRY is not about eliminating all similarity — it is about having a single source of truth for each piece of knowledge.

---

## 1. Naming (Non-Negotiable)

### Rules
- Names must be intention-revealing: `elapsedTimeInDays`, not `d`; `isUserEmailVerified`, not `checked`
- Booleans: prefix with `is`, `has`, `can`, `should` — `isPaymentComplete`, not `paid`
- Functions: use verbs — `calculateMonthlyRevenue`, not `revenue`
- Classes: use nouns — `InvoiceProcessor`, not `InvoiceManager` or `InvoiceData`
- Constants: `MAX_RETRY_ATTEMPTS_ON_NETWORK_FAILURE`, not `MAX_RETRIES`
- No abbreviations unless universally known (`url`, `id`, `api`, `dto`)
- No disinformation: do not name a `Map` as `userList`
- No noise words: `ProductData` vs `ProductInfo` — if they are different, name the difference explicitly

### 2025 TypeScript specifics
```typescript
// BAD
const d = new Date()
const fn = (x: any) => x
const mgr = new UserMgr()

// GOOD
const userRegistrationDate = new Date()
const formatUserDisplayName = (user: User) => `${user.firstName} ${user.lastName}`
const userAccountManager = new UserAccountManager()
```

---

## 2. Functions

### Rules
- **Single Responsibility**: one function does one thing
- **Small**: prefer under 20 lines. If it scrolls, extract
- **One level of abstraction per function**: do not mix business logic with low-level I/O
- **Arguments**: 0 ideal, 1–2 fine, 3 requires justification, 4+ always an object param
- **No boolean parameters that change behavior** — create two named functions instead
- **No side effects**: a function named `getUserById` must not also log, mutate global state, or send an event

```typescript
// BAD: boolean flag changes behavior
function renderButton(disabled: boolean) { ... }

// GOOD: two explicit functions
function renderActiveButton() { ... }
function renderDisabledButton() { ... }

// BAD: 4+ positional args
function createUser(name: string, email: string, role: string, isAdmin: boolean) { ... }

// GOOD: options object
interface CreateUserOptions {
  name: string
  email: string
  role: UserRole
  isAdmin: boolean
}
function createUser(options: CreateUserOptions) { ... }
```

---

## 3. DRY — Single Source of Truth

### Rule of Three (mandatory)
Do not extract until you have at least **3 concrete instances** of the same logic. Two similar things may be coincidentally similar. The wrong abstraction is worse than duplication.

```typescript
// WRONG: extracted after 2nd occurrence — may be coincidental
function formatDate(d: Date) { return d.toISOString().split('T')[0] }
// used in invoice AND in user profile — they may diverge

// RIGHT: wait for 3rd occurrence, then evaluate if the concept is truly shared
```

### What to always keep as single source of truth
- Configuration constants (never define the same magic value in two files)
- Validation rules (one schema, imported everywhere)
- URL/route patterns
- Error message strings visible to users

```typescript
// BAD: same constant in two files
// orders.service.ts
const MAX_ORDER_ITEMS = 50
// cart.service.ts
const MAX_ITEMS = 50

// GOOD: single source
// constants/order-limits.ts
export const MAX_ORDER_ITEMS_PER_CART = 50
```

### When NOT to apply DRY
- **Test code**: test setup that is too DRY becomes unreadable in isolation. Some duplication in test fixtures is intentional and acceptable.
- **Coincidentally similar code**: two loops that happen to iterate the same way but serve different domains should NOT share an abstraction.
- **When indirection costs more than duplication**: 3 readable duplicate lines beats 1 inscrutable helper that requires reading 3 files to understand.

---

## 4. Comments

### Bad comments (rewrite the code instead)
- Redundant: `// increment i` above `i++`
- Misleading: comments that describe what the code used to do
- Position markers: `// ====== SECTION 2 ======`
- Noise: `// Constructor` above a constructor

### Good comments (the only justified kinds)
- Legal / license headers
- Intent for non-obvious regex or algorithm
- Warnings about consequence: `// IMPORTANT: this runs in the hot path — do not add I/O here`
- TODO with ticket reference: `// TODO(#1234): remove after migration completes`

```typescript
// BAD: comment explains what, not why
// Check if user age is greater than 65 and has hourly flag
if (employee.flags & HOURLY && employee.age > 65) { ... }

// GOOD: self-documenting code, no comment needed
if (employee.isEligibleForFullBenefits()) { ... }
```

---

## 5. Error Handling

- **Use exceptions, not return codes** — return codes force the caller to check every time
- **Never return null** from a function that callers will dereference — return an empty array, a Result type, or throw
- **Never pass null** as an argument — it is an invisible contract violation
- **Wrap all external I/O in try/catch** with typed error handling

```typescript
// BAD: return null
function findUserById(id: string): User | null { ... }
// Caller must remember to null-check everywhere

// GOOD: Option/Result pattern or throw
function findUserById(id: string): User {
  const user = db.find(id)
  if (!user) throw new UserNotFoundError(id)
  return user
}

// GOOD: explicit optional with named empty state
function findAllOrdersForUser(userId: string): Order[] {
  return db.findOrders(userId) ?? []
}
```

---

## 6. Classes and Structure

- **Single Responsibility Principle**: one class = one reason to change
- **Newspaper Metaphor**: high-level public API at the top of the file, private implementation details at the bottom
- **Law of Demeter**: do not chain more than one accessor — `user.getAddress().getCity()` is a violation
- **Prefer composition over inheritance** when the relationship is not a true "is-a"

---

## 7. Formatting

- Related lines stay close together (vertical density)
- Unrelated concepts have blank lines between them
- Variables declared near their first use, not at the top of the function
- Consistent indentation — enforced by the project's formatter (Prettier, ESLint, gofmt, etc.) — never argue about style by hand

---

## 8. 2025 TypeScript/JavaScript Patterns

```typescript
// Use satisfies for type-checked object literals without widening
const config = {
  timeout: 5000,
  retries: 3,
} satisfies Partial<RequestConfig>

// Prefer unknown over any for external data
function parseApiResponse(data: unknown): User {
  return UserSchema.parse(data) // zod, valibot, etc.
}

// Use const assertions for literal types
const HTTP_STATUS_CODES = {
  OK: 200,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const

type HttpStatusCode = typeof HTTP_STATUS_CODES[keyof typeof HTTP_STATUS_CODES]

// Prefer named exports over default exports for refactoring safety
// BAD
export default function MyComponent() { ... }
// GOOD
export function MyComponent() { ... }
```

---

## 9. Code Smells — Recognize and Remove

| Smell | Signal | Fix |
|-------|--------|-----|
| Long function | Scrolls beyond 30 lines | Extract named sub-functions |
| Boolean parameter | `fn(true)` at call site | Two named functions |
| Deep nesting (3+ levels) | Arrow anti-pattern | Early returns / guard clauses |
| Magic number | `if (retries > 3)` | Named constant |
| God class | 500+ lines with 20+ methods | Split by responsibility |
| Shotgun surgery | Changing one feature edits 10 files | Consolidate into a module |
| Primitive obsession | `userId: string` everywhere | Value objects or branded types |
| Divergent change | One class changes for 2 different reasons | SRP split |

---

## 10. Review Checklist

Before approving or submitting any code:

- [ ] Every function does exactly one thing
- [ ] No function exceeds 20 lines without strong justification
- [ ] No boolean parameters that change behavior
- [ ] No magic numbers or hardcoded strings
- [ ] No null returns from functions callers will dereference
- [ ] No logic duplicated in 3+ places without a shared abstraction
- [ ] No abstraction created for fewer than 3 instances
- [ ] All names are intention-revealing and self-documenting
- [ ] No comments that explain what — only why or intent
- [ ] External I/O wrapped in typed error handling
- [ ] `any` replaced with `unknown` + runtime validation for untrusted data

---

## Iron Laws

1. **NEVER** extract to a shared abstraction before the third concrete instance — the wrong abstraction is harder to remove than the original duplication.
2. **ALWAYS** use intention-revealing names — the cost of a long name is zero, the cost of an ambiguous name is every future reader.
3. **NEVER** return null from functions that callers will dereference — return empty collections, throw typed errors, or use Result types.
4. **ALWAYS** keep a single source of truth for constants, schemas, and validation rules — divergence is silent and creates unreproducible bugs.
5. **NEVER** use boolean parameters to toggle behavior — create two explicitly named functions instead.
