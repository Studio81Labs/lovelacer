## Summary

<!-- What does this PR do? Why? -->

## Title

<!-- Required format: <type>(<scope>): <short description> -->
<!-- Example: feat(server): add dashboard generation endpoint -->
<!-- Use scope "cross" for genuinely cross-cutting work -->

## Type

<!-- Check one -->

- [ ] Feature (`type:feature`)
- [ ] Bug fix (`type:bugfix`)
- [ ] Refactor (`type:refactor`)
- [ ] Infrastructure / CI (`type:infra` / `type:ci`)
- [ ] Documentation (`type:docs`)
- [ ] Tests (`type:test`)

## Related Issues

<!-- Link issues: Closes #123, Relates to #456 -->

## Risk / Regression Surface

<!-- What could break? Call out user-facing, contract, data, and operational risk -->

## Changes

<!-- Bullet list of what changed -->

-

## Verification

<!-- Paste the commands you ran and the result -->

- ``

## Contract / Schema / Docs Impact

<!-- Delete bullets that do not apply -->

- [ ] No API contract change
- [ ] Server response shapes / shared types updated
- [ ] No add-on packaging change (`apps/addon/`)
- [ ] Add-on manifest / Dockerfile updated
- [ ] No product / process docs change
- [ ] Docs updated
- [ ] Generator output change: PR includes a regression fixture diff or note

## Checklist

- [ ] PR title uses conventional commit format with a scope
- [ ] Scope label(s) are present on the PR (auto-applied or added manually)
- [ ] Linked issue includes priority and scope labels
- [ ] Code compiles without errors (`pnpm build`)
- [ ] Tests pass (`pnpm test`)
- [ ] Lint passes (`pnpm lint`)
- [ ] Typecheck passes (`pnpm typecheck`)
- [ ] No sensitive data committed (env vars, keys, tokens)
- [ ] README / docs updated (if applicable)
