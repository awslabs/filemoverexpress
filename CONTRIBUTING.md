# Contributing to File Mover Express

We welcome contributions to File Mover Express. The full contributor guide is on the documentation
website: [Contributing to File Mover Express](https://awslabs.github.io/filemoverexpress/docs/Contributing).
Its source is [`docs/Contributing.md`](docs/Contributing.md). Development setup is in the
[Development guide](docs/Development.md).

## In short

1. Fork the repository and branch from an up-to-date `main` of `awslabs/filemoverexpress`. Name
   the branch `type/summary-in-kebab-case`, for example `fix/checksum-validation-error`.
2. Make your change, following the existing code patterns, and update the documentation it
   affects.
3. Before committing, run the full lint, test, and build suites:

   ```bash
   task lint
   task test
   task build
   ```

4. Write every commit message in [Conventional Commits](https://www.conventionalcommits.org/) form,
   for example `fix(gui): resolve drag-and-drop issue on Windows`. Each commit addresses one concern.
5. Open a pull request against `main` in `awslabs/filemoverexpress`, with a Conventional Commits
   title, what changed and why, and what you tested. CI must pass.

This is a public repository. Never include AWS account numbers, credentials, or company-internal
information in code, commits, pull requests, issues, or comments.

## Getting help

Search the [existing issues](https://github.com/awslabs/filemoverexpress/issues), or ask in
[GitHub Discussions](https://github.com/awslabs/filemoverexpress/discussions).

## License

By contributing, you agree that your contributions will be licensed under the same license as the
project.
