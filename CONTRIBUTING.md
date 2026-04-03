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

1. Create a feature branch from `main`
2. Make your changes following coding standards
3. Test your changes thoroughly
4. Update documentation if needed
5. Commit with clear messages following [Conventional Commits](https://www.conventionalcommits.org/)

### Testing

Before submitting changes:

**Backend (Go):**
```bash
cd src/cli
make test
make lint
```

**Frontend (Angular):**
```bash
cd src/gui
npm test
npm run lint
```

### Submitting Pull Requests

1. Push your branch to your fork
2. Create a Pull Request with:
   - Clear title and description
   - Reference any related issues
   - Include screenshots for UI changes
   - Ensure all tests pass

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