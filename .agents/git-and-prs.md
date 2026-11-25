# Git and pull requests

Read this before committing, naming a branch, or opening or updating a PR.
If this file and a human-facing document disagree, this file is correct and the
human document gets updated to match.

## Public repository

This repository is public. Never put any of the following in code, commit
messages, branch names, PR titles or descriptions, issues, or review comments:

- AWS account numbers, credentials, tokens, or presigned URLs
- Company-internal hostnames, ticket or code-review links, or tool names
- Log output or screenshots that contain any of the above

Redact before pasting logs.

## Branches

Branch from an up-to-date `main` of the upstream repository
(`awslabs/filemoverexpress`).

Name branches `type/summary-in-kebab-case`. Both parts are required.

- Types: `build`, `ci`, `docs`, `feature`, `fix`, `performance`, `refactor`,
  `test`, `ui`, `deprecate`, `chore`.
- Summary: present tense, lowercase, dashes between words, no trailing period.

Examples: `fix/checksum-validation-error`, `docs/installation-guide-update`.

Never commit to `main` or push to it. Push feature branches only. Do not
rewrite the history of a branch that others use.

## Commits

- Every commit follows [Conventional Commits](https://www.conventionalcommits.org/):
  `type(scope): summary`, for example `fix(gui): keep unmodelled config fields`.
  Changelog generation will be automated from these messages, so the type and
  summary must describe the change accurately.
- Mark breaking changes with `!` after the type or scope, or with a
  `BREAKING CHANGE:` footer.
- Each commit addresses one concern. Keep unrelated changes in separate commits.
- Commit as few commits as possible. Squash fixups and review follow-ups into
  the commit they belong to, without merging concerns that should stay separate.
- Stage files by path (see `AGENTS.md`).
- Run the full lint, test, and build suites before committing
  (`.agents/build-test-lint.md`).

## Pull requests

PRs target `main` in `awslabs/filemoverexpress`, not a fork.

Maintainers merge by squash or by merge commit, depending on the PR. Write every
commit as if it will land on `main` unchanged, and write the PR title as the
squash commit subject.

- **Title:** a Conventional Commits subject, `type(scope): summary`, for example
  `feat(gui): show MHL verification as an inline job-name tag`.
- **Description:** what changed and why, any related issues, and what you
  tested. Include screenshots for UI changes.
- **Checks:** CI runs lint, CLI tests, GUI tests, and Wails tests on every PR,
  plus the e2e suites on relevant changes. All must pass.
- Keep a PR to one concern. Split unrelated cleanups into their own PR.

## Review comments

After pushing a fix for a review comment, resolve its review thread. Hiding or
minimizing a comment does not resolve the thread.

- Resolve a thread only once its fix is pushed.
- When you disagree with a comment, or the fix differs from what was asked,
  reply on the thread and leave it open.
