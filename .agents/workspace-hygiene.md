# Workspace hygiene

Read this before creating any file that is not part of the change you were
asked to make.

## Scratch files go in `.agent-workspace/`

Every temporary or throwaway file belongs in `.agent-workspace/` at the repo
root. That folder is git-ignored, so nothing in it can be committed by accident
(only its `README.md` is tracked). Create subfolders freely, for example one per
task or PR.

This covers:

- planning notes, TODO lists, and scratch lists
- investigation and analysis write-ups
- build, test, and lint logs, and other command-output dumps
- one-off scripts and experiment files
- throwaway mockups and prototypes

Never create these anywhere else in the tree: not the repo root, `src/`,
`docs/`, or a package directory. Names such as `MIGRATION_NOTES.md`,
`*-findings.md`, `*-investigation.md`, `scratch.*`, and `build.log` are the
usual signs of a misplaced file.

`.agents/` is different. It holds committed guidance for agents, so it is not
scratch.

## What belongs in the repo

Commit only files that are part of the change you were asked to make:

| Commit it | Keep in `.agent-workspace/` |
|---|---|
| Source code and tests | Scratch notes, plans, TODO lists |
| User-facing guides under `docs/` | Investigation and analysis write-ups |
| Config the project needs | Build and test logs, command output |
| Design assets the product ships | One-off scripts, experiments, mockups |

`docs/` is published to the public documentation site, so every Markdown file
added there appears on the website. Put only user-facing guides in it.

## Notes worth keeping

When a note is worth keeping, move it to where it belongs rather than leaving a
loose file in the tree:

- the pull request description, for context a reviewer needs
- a GitHub issue, for follow-up work or open questions
- a guide under `docs/`, for lasting user-facing documentation
- an `AGENTS.md` or a file under `.agents/`, for guidance that future agents
  need

## Before you finish

Review `git status` and the diff. Remove or relocate any file that is not part
of the change. Do not delete files in `.agent-workspace/` that you did not
create; they may belong to another session.
