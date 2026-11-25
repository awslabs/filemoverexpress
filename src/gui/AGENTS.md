# src/gui: Angular GUI

Angular app that runs inside the Wails desktop app, or in a browser during
development and the browser e2e suite. It talks to a daemon over ConnectRPC
(gRPC-Web transport) and reaches native features through the Wails bindings.
For layout, see `.agents/architecture.md`; for generated code,
`.agents/codegen.md`.

## Structure

- `components/containers/`: smart components that read state and call services
- `components/primitives/`: presentational components driven by inputs and
  outputs only
- `components/layout/`: the shell and the main panes (file browser, bucket
  browser, transfer)
- `components/modals/`: dialogs, one folder per modal
- `services/`: one folder per feature service
- `state/`: NgRx store, one folder per domain with `actions/`, `effects/`,
  `reducers/`, and a `<domain>.selectors.ts`
- `src/testing/`: Vitest setup and the Wails mocks

## Conventions

- **Standalone components only.** Do not add `NgModule`s.
- **Selectors use the `fme` prefix:** `fme-kebab-case` for components,
  `fmeCamelCase` for directives. ESLint enforces both.
- **Each component has its own folder** with `.component.ts`, `.html`, and
  `.scss` files, and sets `changeDetection` explicitly. Existing components use
  `ChangeDetectionStrategy.Eager`.
- **Dependency injection:** use `inject()`, not constructor parameters.
- **Inputs and outputs:** use the signal-based `input()`, `output()`, and
  `model()` in new code.
- **Templates:** use the built-in control flow (`@if`, `@for`, `@switch`), not
  `*ngIf` or `*ngFor`.
- **Talking to the daemon:** go through `services/fme-client/`. Shared app
  state lives in the NgRx store, not in component fields.
- **Native features:** go through `services/wails/` only. Code must also work
  in a plain browser, where the Wails runtime is absent.
- **Imports:** use the path aliases in `tsconfig.json` (`@app/`, `@services/`,
  `@state/`, `@classes/`, `@containers/`, `@primitives/`, `@modals/`, `@gen/`,
  `@wailsApp/`). Do not use `@connect/` or `@fme/`; they point at folders that
  no longer exist.
- **UI components:** use Angular Material and the CDK before writing custom
  widgets.
- TypeScript runs in strict mode with strict templates.

## Lint rules

`task gui:lint` runs ESLint on the app (`.ts` and `.html`) and on the browser
e2e tests, and type-checks the e2e tests. Rules that most often fail:

- 4-space indentation, single quotes, semicolons
- trailing commas on multiline arrays, objects, imports, exports, and
  parameters
- braces on every `if`, `else`, and loop (`curly: all`)
- unused variables fail, except arguments prefixed with `__`
- template accessibility rules (`templateAccessibility`)

Fix findings instead of suppressing them. Add an `eslint-disable` comment or a
config exception only after the user explicitly approves that specific
suppression.

## Tests

- Unit tests are Vitest, run through `ng test` by `task gui:test` (jsdom,
  coverage on). Use `task gui:test`; it sets the Node options the suite needs.
- Specs sit beside the code as `*.spec.ts`.
- Tests run isolated, one file per module context, so `vi.mock` stubs apply
  only to the file that declares them.
- The Wails runtime and bindings are replaced by the mocks in
  `src/testing/mocks/` through `vitest.config.mts`. A new Wails binding that
  tests import needs a matching mock.
- Use `@fast-check/vitest` for property-based tests where input space is large.
- Do not skip, disable, or exclude a test or its code from coverage without
  the user's explicit approval of that specific case.

## Browser e2e tests

Playwright tests in `e2e/` drive the GUI against a real daemon. Find elements
by role, name, and visible text; the GUI has no test IDs. Details are in
`e2e/README.md`, and how to run them is in `.agents/build-test-lint.md`.
