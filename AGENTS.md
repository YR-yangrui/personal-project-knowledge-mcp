# Repository Guidelines

## Project Structure & Module Organization

This repository contains a local MCP server for personal AI memory and Markdown document management. Core TypeScript sources live in `src/`; the main MCP entry point is `src/index.ts`, with storage and domain logic in files such as `src/repository.ts`, `src/db.ts`, `src/markdown.ts`, and `src/service.ts`. Runtime helper scripts are under `src/scripts/`. PowerShell install, uninstall, and packaging scripts are in `scripts/`. Generated JavaScript output belongs in `dist/` and should be treated as build output. Documentation and distributable adapters live in `docs/`, `plugin/`, `codex-plugin/`, and `skills/`. Static web assets are in `public/`.

## Build, Test, and Development Commands

- `npm install` installs dependencies from `package-lock.json`.
- `npm run dev` starts the MCP server from `src/index.ts` using `tsx`.
- `npm run build` compiles TypeScript into `dist/`.
- `npm start` runs the compiled MCP server from `dist/index.js`.
- `npm run seed` initializes sample or seed data.
- `npm run verify` runs the repository verification script.
- `npm run verify:web` verifies the web-facing workflow.
- `npm run web` starts the TypeScript web server; `npm run web:dist` runs the compiled version.
- `npm run install:win` and `npm run install:codex` execute Windows installation flows.

## Coding Style & Naming Conventions

Use TypeScript ES modules with `NodeNext` module resolution and strict compiler settings. Keep source files under `src/` and prefer focused modules with descriptive names such as `repository.ts` or `context-markdown.ts`. Use two-space indentation, camelCase for functions and variables, PascalCase for classes and exported types, and kebab-case for script or package-facing names. Add comments only where they explain non-obvious behavior, migration logic, data safety, or compatibility constraints.

## Testing Guidelines

There is no dedicated unit test framework configured yet. Use `npm run build` for type checking and `npm run verify` for functional validation before submitting changes. When changing web behavior, also run `npm run verify:web`. Name future tests after the module or behavior they cover, for example `repository.writeDocument.test.ts`.

## Commit & Pull Request Guidelines

Recent commits use short, imperative summaries such as `Add storage migration and bug report tools`. Follow that style: start with a verb, keep the subject concise, and group related changes. Pull requests should include a brief description, validation commands run, linked issues if any, and screenshots only for visible web UI changes.

## Security & Configuration Tips

The default data directory is `%USERPROFILE%\.personal-project-knowledge-mcp`; override it with `PPKM_DATA_ROOT` when needed. Do not commit local data, secrets, generated backups, or user-specific configuration files.
