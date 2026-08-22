# Agent Workspace & Repo Hygiene

Keep the repository clean of AI-agent scratch. This applies to every task.

## Put working files in `.agent-workspace/`

Any temporary or throwaway file you create — planning notes, investigation and
analysis write-ups, TODO/scratch lists, build and test logs, command-output
dumps, one-off scripts, experimental mockups or prototypes — **MUST** be written
inside the git-ignored `.agent-workspace/` folder at the repo root.

Never create these files anywhere else in the tree (repo root, `src/`, `docs/`,
package directories). Stray files such as `MIGRATION_NOTES.md`, `*-findings.md`,
`*-investigation.md`, `scratch.*`, or `build.log` must not be committed.

## Only commit real project artifacts

Commit only files that are part of the change you were asked to make: source,
tests, real documentation under `docs/`, and config the project needs. If a note
is worth keeping, put it in a pull-request description or a GitHub issue — not a
loose file in the repo.

- Stage files explicitly; do not `git add .` or `git add -A` (they sweep up scratch).
- Review `git status` and the diff before committing, and drop anything unrelated.
- This is a public repository: never commit AWS account numbers, credentials, or
  other sensitive identifiers.

See `AGENT.md` at the repo root for the full policy.
