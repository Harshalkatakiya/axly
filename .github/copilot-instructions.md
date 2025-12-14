# AI Coding Assistant Instructions for Axly npm package build with Typescript

## Project Overview

Axly is a powerful and flexible HTTP client library built on top of Axios, designed for seamless API interactions in both browser and Node.js environments. It provides advanced features like automatic token refreshing, retry mechanisms with exponential backoff, upload/download progress tracking, toast notifications (browser-only), request cancellation, and support for multiple API configurations. Axly simplifies authentication flows, error handling, and state management, making it ideal for modern web and server-side applications.

## Core Architecture

### Tech Stack

- **Axios** for HTTP requests
- **TypeScript** with strict type checking

### Code Quality

- **Linting**: `bun run lint` (ESLint with React hooks)
- **Type Safety**: Don't use `any` TypeScript types; leverage TypeScript features
- **Formatting**: `bun run prettier` (Prettier with Tailwind plugin)
- **Pre-commit**: Husky + lint-staged auto-formats on commit
- Don't use JSDoc comments for type annotations.
- use deepwiki and context7.
