# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package

Axly is a powerful and flexible HTTP client library built on top of Axios, designed for seamless API interactions in both browser and Node.js environments. It provides automatic token refreshing, retry with exponential backoff, upload/download progress tracking, request deduplication, response caching, toast notifications (browser-only), request cancellation, and support for multiple API configurations.(`"type": "module"`). Uses `bun` as package manager (see `packageManager` field) — prefer `bun` over `npm` for consistency.

## Commands

```bash
bun run build           # tsc — emits to dist/ (no bundler)
bun run watch           # tsc --watch
bun run lint            # eslint . --fix
bun run prettier:check  # prettier -c .
bun run prettier        # prettier -w -u .
bun run release         # tsc && npm version patch && npm publish --access public --tag latest
```

There is no test suite. Husky `pre-commit` runs `lint-staged` → `bun run lint` → `bun run build`, so commits fail if types or lint break.

## Conventions

- TypeScript `strict: true`, `"@typescript-eslint/no-explicit-any": "error"` — **never** use `any`. Use `unknown` + type guards (see `isAxlyConfig`, `hasMessageInResponse`).
- No JSDoc type annotations — TS handles types.
- Module resolution is `nodenext`: imports **must** use explicit `.js` extensions even when importing `.ts`/`.tsx` sources.
- `verbatimModuleSyntax: false`, so `import type` is optional but preferred for type-only imports (hooks use it consistently).
- Ignore unused vars/args prefixed with `_` (`argsIgnorePattern: '^_'`).
- The `/* global AbortController */` comment at the top of `index.ts` and `client.ts` is intentional — it satisfies ESLint without pulling DOM globals into Node-targeted files.

## Version bumping & publishing

`bun run release` auto-bumps the patch version and publishes. Do **not** run it unless the user explicitly asks to release. For manual version bumps, edit `package.json` `version` directly — there is no changeset or changelog tooling.

## Code Standards

- **No `any` TypeScript types** — use proper types or generics throughout
- **No JSDoc comments** for type annotations
- **Pre-commit hooks** (Husky + lint-staged) auto-run ESLint + Prettier on every commit
- Use skills, context7, and deepwiki MCPs when relevant
