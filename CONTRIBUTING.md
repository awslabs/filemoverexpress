# Contributing to File Mover Express

We welcome contributions to File Mover Express! This document provides guidelines for contributing to the project.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/filemoverexpress.git
   cd filemoverexpress
   ```
3. **Set up the development environment** following the installation guide
4. **Create a feature branch** following our branch naming conventions

## Branch Naming Convention

Follow this format when creating git branches:

```
type/summary-in-kebab-case
  |    |
  |    └─⫸ Summary in present tense. Not capitalized. No period at the end. Replace spaces with dashes.
  |
  └─⫸ Branch Type: build|ci|docs|feature|fix|performance|refactor|test|ui|deprecate|chore
```

Both the type and summary fields are mandatory.

### Branch Types

Must be one of the following:

* **build**: Changes that affect the build system or external dependencies
* **ci**: Changes to CI configuration files and scripts
* **docs**: Documentation only changes
* **feature**: A new feature
* **fix**: A bug fix
* **performance**: A code change that improves performance
* **refactor**: A code change that neither fixes a bug nor adds a feature
* **test**: Adding missing tests or correcting existing tests
* **ui**: Changes that affect the GUI
* **deprecate**: A removal of an existing feature
* **chore**: Code with no functional changes but needs to be done

### Examples

```bash
git checkout -b feature/bucket-reports-export
git checkout -b fix/checksum-validation-error
git checkout -b docs/installation-guide-update
```

## Development Workflow

### Making Changes

1. Create a feature branch from an up-to-date `main` of the upstream
   repository (`awslabs/filemoverexpress`), named as described above:
   ```bash
   git fetch upstream
   git checkout -b feature/your-feature-name upstream/main
   ```
2. Make your changes, following the existing code patterns.
3. Run the full checks (see Testing).
4. Update documentation if needed.
5. Commit following the commit guidelines below.

### Testing

The project uses [Task](https://taskfile.dev) as its build runner. Before
committing, run the full lint, test, and build suites:

```bash
task lint
task test
task build
```

Also run these when they apply:

- If you changed a `.proto` file, run `buf lint` in `src/protobuf`. CI runs it,
  but `task lint` does not.
- If your change touches the daemon, the GUI, the desktop app, the protobuf
  definitions, the CI images, or the build, run the end-to-end suites with
  `task e2e:docker` (needs Docker). The exact paths are listed in
  `.github/workflows/ci.yml`.

Narrower targets such as `task cli:test` or `task gui:test` are faster while
you work, but they do not replace the full run before committing.

### Committing Changes

- Every commit follows [Conventional Commits](https://www.conventionalcommits.org/).
  The changelog will be generated from commit messages, so the type and summary
  must describe the change accurately.
- Mark breaking changes with `!` after the type or scope, or with a
  `BREAKING CHANGE:` footer.
- Each commit addresses one concern.
- Keep the number of commits small: squash fixups and review follow-ups into
  the commit they belong to.

### Submitting Pull Requests

1. Push your branch to your fork.
2. Open a pull request against `main` in `awslabs/filemoverexpress` with:
   - a title in Conventional Commits form, for example
     `feat(gui): show MHL verification as an inline job-name tag`.
     Maintainers merge by squash or by merge commit depending on the PR; on a
     squash merge the title becomes the commit message
   - what changed and why, related issues, and what you tested
   - screenshots for UI changes
3. CI must pass: lint, CLI tests, GUI tests, Wails tests, and the end-to-end
   suites when they apply.

Keep each pull request to one concern. This is a public repository: never
include AWS account numbers, credentials, or company-internal information in
code, commits, pull requests, issues, or comments.

## Code Style

- **Go**: Follow standard Go formatting (`gofmt`)
- **TypeScript/Angular**: Follow Angular style guide
- **Documentation**: Use clear, concise language with examples

## Types of Contributions

### Bug Reports
Include environment details, steps to reproduce, expected vs actual behavior, and relevant logs.

### Feature Requests
Provide use case, proposed solution, and implementation considerations.

### Documentation
Fix typos, improve clarity, add missing information, update outdated content.

## Community Guidelines

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Follow the project's code of conduct

## Getting Help

1. Check existing documentation
2. Search existing issues
3. Ask questions in GitHub Discussions
4. Review troubleshooting guides

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

Thank you for contributing to File Mover Express!