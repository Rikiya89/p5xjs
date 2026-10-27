# Repository guidance

## Structure and boundaries

- This repository contains independent, date-stamped p5.js sketches. Start with the target folder's `index.html`, script order, assets, and any README; conventions and dependencies can differ between sketches. `p5.js`, `p5.min.js`, and `addons/` are shared libraries, and `empty-example/` is a starter.
- Keep changes in the requested sketch and reuse its existing code and styles. Preserve visual composition, animation timing, input, capture/export behavior, dependencies, and responsive behavior unless the request changes them. Do not modify bundled libraries or other sketches unnecessarily.
- Follow the target's existing JavaScript, HTML, CSS, shader, and, where present, SCSS conventions and mixins. Do not introduce a framework, redesign, deployment, or unrelated refactoring.

## Reproduce and verify

- Use Node >=22 as declared in `package.json` (Volta pins 22.22.1). Keep the existing npm lockfile and BrowserSync tooling.
- For a bug, reproduce it before editing when practical; record the steps and observed result. If reproduction is unavailable, state why and use the best available evidence. Fix the cause with the smallest safe change and rerun the reproduction.
- Run `npm test` for the existing Node regression tests when relevant; they cover selected sketches and do not prove browser rendering or export. Use relevant sketch-specific checks if present. There are currently no repository lint, typecheck, or build scripts; do not claim those checks ran.
- For changed standalone JavaScript, `node --check <file>` provides a syntax check without running p5; use it only where the file syntax is supported by Node. Run `git diff --check` for tracked edits and review new files separately.
- For frontend or visual changes, run `npm run dev` from the repository root and open `http://localhost:3003/<sketch-folder>/` in an available browser (or use the sketch's documented server). Check the affected behavior and console at relevant desktop and mobile viewport sizes, including controls, canvas layout and interaction as applicable. Compare against the requested visual behavior; exercise capture/export separately when affected. Record viewport sizes and results. If browser, GPU, network, or export support is unavailable, report the gap rather than substituting static checks.
- Use the existing browser and tools for validation. Add Playwright only when justified and explicitly approved.
- Select checks for the actual change. For failures, report the command or reproduction, error, and affected behavior; correct change-caused failures and rerun the affected check. After initial verification, allow at most two correction cycles (one correction followed by the affected recheck per cycle), then report unresolved failures and next steps. Do not disable checks to obtain a pass.
- Finish with changed files, executed checks and results, remaining gaps, and one suggested next improvement. Report any unverified runtime, visual, or export behavior. Never label an unrun check as passed.
