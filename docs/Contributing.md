# Contributing to File Mover Express

We welcome contributions to File Mover Express! This document provides guidelines for contributing to the project.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/filemoverexpress.git
   cd filemoverexpress
   ```
3. **Set up the development environment** following the [Installation](Installation) guide
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

* **build**: Changes that affect the build system or external dependencies (example: npm, Go modules)
* **ci**: Changes to CI configuration files and scripts (GitHub Actions, etc.)
* **docs**: Documentation only changes
* **feature**: A new feature
* **fix**: A bug fix
* **performance**: A code change that improves performance
* **refactor**: A code change that neither fixes a bug nor adds a feature
* **test**: Adding missing tests or correcting existing tests
* **ui**: Changes that affect the GUI (can be purely cosmetic)
* **deprecate**: A removal of an existing feature
* **chore**: Code with no functional changes but needs to be done (dependency updates, etc.)

### Summary Guidelines

Use the summary field to provide a succinct description of the change:

* Don't capitalize the first letter
* No dot (.) at the end
* Replace spaces with dashes
* Use present tense

### Examples

```bash
git checkout -b feature/bucket-reports-export
git checkout -b fix/checksum-validation-error
git checkout -b docs/installation-guide-update
git checkout -b performance/transfer-speed-optimization
```

## Development Workflow

### 1. Setting Up Your Environment

Follow the [Installation](Installation) guide to set up your development environment with:
- **Go**: the version in `src/cli/go.mod`
- **Node.js** and npm: the version CI uses is `NODE_VERSION` in
  `.github/versions.env`
- Angular CLI
- Git

### 2. Making Changes

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

### 3. Testing

The project uses [Task](https://taskfile.dev) as its build runner. Before
committing, run the full lint, test, and build suites:

```bash
task lint
task test
task build
```

Also run these when they apply:

- If you changed a `.proto` file, run `task proto:breaking` to check for breaking
  changes. It compares with `origin/main`; pass `BASE=<ref>` to use another ref,
  such as `upstream/main` in a fork.
- If your change touches the daemon, the GUI, the desktop app, the protobuf
  definitions, the CI images, or the build, run the end-to-end suites with
  `task e2e:docker` (needs Docker). The exact paths are listed in
  `.github/workflows/ci.yml`.

Narrower targets such as `task cli:test` or `task gui:test` are faster while
you work, but they do not replace the full run before committing.

### 4. Committing Changes

Follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Examples:**
```bash
git commit -m "feat(cli): add bucket inventory command"
git commit -m "fix(gui): resolve drag-and-drop issue on Windows"
git commit -m "docs: update installation instructions for macOS"
```

- Every commit follows Conventional Commits. The changelog will be generated
  from commit messages, so the type and summary must describe the change
  accurately.
- Mark breaking changes with `!` after the type or scope, or with a
  `BREAKING CHANGE:` footer.
- Each commit addresses one concern.
- Keep the number of commits small: squash fixups and review follow-ups into
  the commit they belong to.

### 5. Submitting Pull Requests

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

## Code Style Guidelines

### Go Code Style

- Follow standard Go formatting (`gofmt`)
- Use meaningful variable and function names
- Add comments for exported functions and complex logic
- Follow the existing project structure

### TypeScript/Angular Code Style

- Follow Angular style guide
- Use TypeScript strict mode
- Implement proper error handling
- Follow existing component patterns

### Documentation Style

- Use clear, concise language
- Include code examples where helpful
- Follow existing markdown formatting
- Update relevant wiki pages

## Types of Contributions

### Bug Reports

When reporting bugs, please include:
- **Environment details**: OS, File Mover Express version, Go/Node.js versions
- **Steps to reproduce**: Clear, step-by-step instructions
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Logs/Screenshots**: Any relevant error messages or screenshots

### Feature Requests

For new features, please provide:
- **Use case**: Why is this feature needed?
- **Proposed solution**: How should it work?
- **Alternatives considered**: Other approaches you've thought about
- **Implementation details**: Technical considerations (if applicable)

### Documentation Improvements

Documentation contributions are highly valued:
- Fix typos and grammatical errors
- Improve clarity and organization
- Add missing information
- Update outdated content
- Translate documentation (if applicable)

### Code Contributions

Code contributions should:
- Solve a real problem or add valuable functionality
- Include appropriate tests
- Follow existing code patterns and style
- Include documentation updates
- Be well-tested across platforms

## Development Environment Setup

### Prerequisites

Ensure you have the required tools installed:
- **Go**: the version in `src/cli/go.mod`
- **Node.js**: a release Angular supports (see the [Development guide](Development.md)), plus **npm**
- **Task**: The build runner ([install guide](https://taskfile.dev/installation/))
- **Wails CLI** (`wails3`): For building the desktop app (`go install github.com/wailsapp/wails/v3/cmd/wails3@latest`)
- **Git**: Latest version

See the [Development guide](Development.md) for full setup instructions and platform-specific
install commands.

### Building the Project

```bash
npm install                 # install workspace dependencies
task generate               # generate protobuf + Wails bindings
task build                  # build CLI, GUI, and desktop app for the current platform
```

Individual targets: `task cli:build`, `task gui:build`, `task wails:build`.

### Running Tests

```bash
task test                   # all unit tests (CLI, Wails, GUI)
task cli:test               # Go CLI tests
task gui:test               # GUI tests (Vitest)
```

### Linting

```bash
task lint                   # run all linters
```

## Community Guidelines

### Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Respect different viewpoints and experiences

### Communication

- **GitHub Issues**: For bug reports and feature requests
- **Pull Requests**: For code contributions and discussions
- **Discussions**: For general questions and community interaction

### Getting Help

If you need help:
1. Check existing [documentation](Home)
2. Search [existing issues](https://github.com/awslabs/filemoverexpress/issues)
3. Ask questions in [GitHub Discussions](https://github.com/awslabs/filemoverexpress/discussions)
4. Review the [Troubleshooting](Troubleshooting) guide

## Recognition

Contributors will be recognized in:
- Release notes for significant contributions
- README.md contributors section
- GitHub contributor statistics

## License

By contributing to File Mover Express, you agree that your contributions will be licensed under the same license as the project.

## Questions?

If you have questions about contributing, please:
- Open a [GitHub Discussion](https://github.com/awslabs/filemoverexpress/discussions)
- Create an [issue](https://github.com/awslabs/filemoverexpress/issues) with the "question" label
- Review existing documentation and issues first

Thank you for contributing to File Mover Express!