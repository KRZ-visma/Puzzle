## Summary

<!-- What changed for players or maintainers? -->

## Tests

- [ ] Player-facing / flow change → updated or added Playwright coverage in `tests/e2e/`
- [ ] Pure logic change → updated or added unit coverage in `tests/unit/`
- [ ] Ran `npm run test:unit` and `npm run test:e2e` locally (or relied on CI)
- [ ] No behavior change (docs/chore/style only) — tests not required

<!-- If tests are intentionally skipped for a behavior change, include exactly:
tests-not-required: <short reason>
-->

## Checklist

- [ ] Followed `AGENTS.md` hard rules (modules, `localStorage`, PWA, versioning)
- [ ] New cacheable static files added to `sw.js` `SHELL` when needed
- [ ] Kept changes scoped; avoided unrelated refactors
