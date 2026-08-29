---
name: vue-nuxt-master
description: Unified Vue 3 + Nuxt 4 + TypeScript expert skill. Use when building components, pages, composables, server routes, or full features with the Vue/Nuxt stack. Covers Composition API, Pinia, VueUse, Tailwind, SSR/CSR patterns, security, performance, and project conventions.
paths: "**/*.{vue,ts,tsx}"
---

# Vue 3 / Nuxt 4 Master Skill

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Vue 3 + Nuxt 4 |
| Language | TypeScript (strict) |
| State | Pinia |
| Styling | Tailwind CSS (or @nuxt/ui) |
| Utilities | VueUse |
| Validation | Zod |
| Testing | Vitest + @vue/test-utils |

---

## 1. Non-Negotiable Defaults

- Always `<script setup lang="ts">` — never Options API, never `defineComponent` wrappers
- Prefer `types` over `interfaces` in TypeScript
- Never use `any` — use `unknown` + type guard if the shape is truly unknown
- No `enums` — use `const` objects with `as const`
- No magic strings or numbers — name every constant
- Composition API only: `ref`, `reactive`, `computed`, `watch`, `watchEffect`
- Never destructure a `reactive()` object directly — use `toRefs()` or switch to `ref()`

---

## 2. Naming Conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Directories | `kebab-case` | `components/auth-wizard/` |
| Vue components | `PascalCase` | `UserProfileCard.vue` |
| Composables | `camelCase` with `use` prefix | `useAuthState.ts` |
| Pages | `kebab-case` | `pages/user-profile.vue` |
| Variables | descriptive + aux verb | `isLoading`, `hasError`, `canSubmit` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_RETRY_ATTEMPTS` |

---

## 3. Component Structure

File order inside every `.vue`:

```
1. <script setup lang="ts">
2. <template>
3. <style scoped>   (only if not using Tailwind exclusively)
```

```vue
<script setup lang="ts">
// 1. Imports
import { ref, computed, watch } from 'vue'
import { useUserStore } from '@/stores/user'

// 2. Props & Emits
interface Props {
  userId: string
  isReadOnly?: boolean
}
const props = withDefaults(defineProps<Props>(), { isReadOnly: false })
const emit = defineEmits<{
  'update:value': [value: string]
  'submit': [payload: SubmitPayload]
}>()

// 3. Composables / stores
const userStore = useUserStore()

// 4. State (refs)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

// 5. Computed
const displayName = computed(() => userStore.profile?.name ?? 'Unknown')

// 6. Watchers
watch(() => props.userId, (newId) => {
  if (newId) loadUser(newId)
}, { immediate: true })

// 7. Functions
async function loadUser(id: string) {
  isLoading.value = true
  try {
    await userStore.fetchById(id)
  } catch (error) {
    errorMessage.value = 'Failed to load user'
  } finally {
    isLoading.value = false
  }
}
</script>
```

---

## 4. TypeScript Patterns

```typescript
// Const object instead of enum
const UserRole = {
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer',
} as const
type UserRole = typeof UserRole[keyof typeof UserRole]

// Typed composable return
export function useCounter(initialValue: number = 0) {
  const count = ref(initialValue)
  const increment = () => count.value++
  const reset = () => (count.value = initialValue)
  return { count: readonly(count), increment, reset }
}

// Avoid any — use unknown + guard
function parseApiResponse(raw: unknown): UserProfile {
  if (!isUserProfile(raw)) throw new Error('Invalid profile shape')
  return raw
}
```

---

## 5. Performance Patterns

### computed — never recalculate in template

```typescript
// BAD: recalculates every render
// <div>{{ items.filter(i => i.active).length }}</div>

// GOOD: cached until dependency changes
const activeItemCount = computed(() => items.value.filter(i => i.active).length)
```

### shallowRef for large / non-reactive-need objects

```typescript
// BAD: deep reactivity on 100k-vertex mesh
const meshData = ref<MeshData>({ vertices: new Float32Array(100000) })

// GOOD: shallow + manual trigger when full replacement
const meshData = shallowRef<MeshData>({ vertices: new Float32Array(100000) })
meshData.value = { ...newMeshData }
triggerRef(meshData)
```

### v-memo for expensive list re-renders

```vue
<!-- Only re-renders row when item.id or item.updatedAt changes -->
<div v-for="item in items" :key="item.id" v-memo="[item.id, item.updatedAt]">
  <ExpensiveRow :data="item" />
</div>
```

### defineAsyncComponent for lazy-loaded heavy components

```typescript
const HeavyChart = defineAsyncComponent({
  loader: () => import('@/components/HeavyChart.vue'),
  loadingComponent: Spinner,
  errorComponent: ErrorDisplay,
  delay: 200,
  timeout: 10_000,
  onError(error, retry, fail) {
    if (error.message.includes('network')) retry()
    else fail()
  },
})
```

### Virtual scrolling for long lists (VueUse)

```vue
<script setup lang="ts">
import { useVirtualList } from '@vueuse/core'
const { list, containerProps, wrapperProps } = useVirtualList(items, { itemHeight: 48 })
</script>
<template>
  <div v-bind="containerProps" class="h-96 overflow-auto">
    <div v-bind="wrapperProps">
      <div v-for="{ data, index } in list" :key="index">
        <ItemRow :item="data" />
      </div>
    </div>
  </div>
</template>
```

### Debounced watchers for search/input

```typescript
import { watchDebounced } from '@vueuse/core'

watchDebounced(
  searchQuery,
  async (query) => {
    if (query.length >= 2) {
      results.value = await $fetch(`/api/search?q=${encodeURIComponent(query)}`)
    }
  },
  { debounce: 300 },
)
```

### ClientOnly for browser-only components (SSR safety)

```vue
<template>
  <ClientOnly>
    <BrowserOnlyComponent />
    <template #fallback><Skeleton /></template>
  </ClientOnly>
</template>
```

---

## 6. Nuxt 4 Conventions

### Directory structure

```
app/
  assets/
  components/
  composables/
  layouts/
  middleware/
  pages/
  plugins/
  utils/
server/
  api/
  middleware/
  plugins/
  utils/
shared/        ← new in Nuxt 4, isomorphic code
  types/
  utils/
```

### Data fetching

```typescript
// useFetch — declarative, component-bound, auto-deduped in Nuxt 4
const { data: user, status, error, refresh } = await useFetch(`/api/users/${id}`, {
  key: `user-${id}`,          // stable key for deduplication
  transform: (raw) => parseUser(raw),
  getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key],  // Nuxt 4 cache control
})

// useAsyncData — for custom fetchers
const { data: products } = await useAsyncData(
  'products',
  () => $fetch('/api/products'),
  { watch: [categoryId] },    // reactive refetch when categoryId changes
)
```

### Runtime config — secrets stay server-side

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,  // server only
    public: {
      apiBase: '/api',                       // client accessible
    },
  },
})
```

### SEO — every page component

```typescript
// Composable pattern (preferred)
useSeoMeta({
  title: computed(() => `${product.value.name} | My Store`),
  description: computed(() => product.value.description),
  ogImage: computed(() => product.value.imageUrl),
})

// Or definePageMeta for static metadata
definePageMeta({
  title: 'Dashboard',
  layout: 'admin',
  middleware: ['auth'],
})
```

### Route middleware (auth pattern)

```typescript
// middleware/auth.ts
export default defineNuxtRouteMiddleware((to) => {
  const { isAuthenticated } = useAuthState()
  if (!isAuthenticated.value && to.meta.requiresAuth) {
    return navigateTo('/login', { redirectCode: 302 })
  }
})
```

### Server route with Zod validation

```typescript
// server/api/users/[id].get.ts
import { z } from 'zod'

const paramsSchema = z.object({ id: z.string().uuid() })

export default defineEventHandler(async (event) => {
  const params = await getValidatedRouterParams(event, paramsSchema.parse)
  const user = await db.user.findUnique({ where: { id: params.id } })

  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  return user
})
```

---

## 7. State Management (Pinia)

```typescript
// stores/user.ts
export const useUserStore = defineStore('user', () => {
  const profile = ref<UserProfile | null>(null)
  const isLoading = ref(false)

  const displayName = computed(() => profile.value?.name ?? 'Guest')

  async function fetchById(id: string) {
    isLoading.value = true
    try {
      profile.value = await $fetch<UserProfile>(`/api/users/${id}`)
    } finally {
      isLoading.value = false
    }
  }

  return { profile, isLoading, displayName, fetchById }
})
```

---

## 8. Security Standards

### Never use v-html with unsanitized content

```vue
<!-- BAD: XSS vector -->
<div v-html="userProvidedContent" />

<!-- GOOD: plain text (preferred) -->
<span v-text="userProvidedContent" />

<!-- GOOD: sanitized when HTML is genuinely needed -->
<div v-html="sanitizeHTML(userProvidedContent)" />
```

```typescript
// composables/useSanitize.ts
import DOMPurify from 'isomorphic-dompurify'

export function useSanitize() {
  const sanitizeHTML = (dirty: string) =>
    DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'span'],
      ALLOWED_ATTR: ['class', 'href'],
    })

  const sanitizeText = (input: string) =>
    DOMPurify.sanitize(input, { ALLOWED_TAGS: [] })

  return { sanitizeHTML, sanitizeText }
}
```

### Validate all server inputs with Zod

Every server route validates with `getValidatedRouterParams`, `getValidatedQuery`, or `readValidatedBody`. Never trust raw `readBody` output.

### CSP headers in nuxt.config

```typescript
export default defineNuxtConfig({
  routeRules: {
    '/**': {
      headers: {
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    },
  },
  devtools: { enabled: process.env.NODE_ENV === 'development' },
})
```

### Known CVEs to keep patched

| CVE | Severity | Fix |
|-----|----------|-----|
| CVE-2024-34344 | HIGH | Nuxt >= 3.12.4 / Nuxt 4 |
| CVE-2024-23657 | HIGH | @nuxt/devtools >= 1.3.9 |
| CVE-2023-3224 | CRITICAL | Never expose dev server publicly |

---

## 9. i18n (when project uses it)

- Never hardcode UI strings. Always use `$t('key')` in templates or `useI18n().t('key')` in `<script setup>`.
- Keys in `snake_case` grouped by feature: `auth.login.title`, `errors.required_field`.
- SEO pages: set `useHead` locale + hreflang via `useI18n`.

---

## 10. Composables Pattern

```typescript
// composables/useAsync.ts — generic async state wrapper
export function useAsync<T>(
  fn: () => Promise<T>,
  options: { immediate?: boolean } = {},
) {
  const data = ref<T | null>(null)
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  async function execute() {
    isLoading.value = true
    error.value = null
    try {
      data.value = await fn()
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
    } finally {
      isLoading.value = false
    }
  }

  if (options.immediate) execute()

  return { data: readonly(data), isLoading: readonly(isLoading), error: readonly(error), execute }
}
```

---

## 11. Testing

```typescript
// Component test template
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import UserCard from '@/components/UserCard.vue'

describe('UserCard', () => {
  const createWrapper = (props = {}) =>
    mount(UserCard, {
      props: { userId: '123', ...props },
      global: { plugins: [createTestingPinia({ createSpy: vi.fn })] },
    })

  it('shows loading state while fetching', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('[data-testid="skeleton"]').exists()).toBe(true)
  })

  it('emits submit with validated payload', async () => {
    const wrapper = createWrapper()
    await wrapper.find('button[type="submit"]').trigger('click')
    expect(wrapper.emitted('submit')?.[0]).toBeDefined()
  })
})
```

---

## 12. Quick Reference

```bash
# Dev
npx nuxi dev

# Type check
npx nuxi typecheck

# Build
npx nuxi build

# Generate (static)
npx nuxi generate

# Add module
npx nuxi module add @nuxt/image

# Security audit
npm audit --audit-level=high
```

### Key auto-imports (no manual import needed in Nuxt)

- `ref`, `reactive`, `computed`, `watch`, `watchEffect`
- `useFetch`, `useAsyncData`, `useRoute`, `useRouter`
- `useState`, `useRuntimeConfig`, `useAppConfig`
- `definePageMeta`, `useSeoMeta`, `useHead`
- `navigateTo`, `createError`, `defineEventHandler`
- All composables in `composables/` and `utils/` directories

---

## 13. Pre-deploy Checklist

- [ ] Nuxt 4 stable (or >= 3.12.4 if still on v3)
- [ ] `@nuxt/devtools` disabled in production (`devtools.enabled: false`)
- [ ] No secrets in `runtimeConfig.public`
- [ ] All user inputs sanitized (DOMPurify) or plain text (`v-text`)
- [ ] Server routes validate with Zod
- [ ] Auth middleware on all protected routes
- [ ] `npm audit` clean (no high/critical)
- [ ] TypeScript compilation passes (`nuxi typecheck`)
- [ ] Core Web Vitals checked: LCP < 2.5s, INP < 200ms, CLS < 0.1
- [ ] Images have `alt` text and use `@nuxt/image` (`<NuxtImg>`)
- [ ] Semantic HTML — no `div` where `button`/`nav`/`main` belong
- [ ] All interactive elements keyboard-accessible
