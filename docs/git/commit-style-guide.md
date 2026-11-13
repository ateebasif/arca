# Git Commit Style Guide

This guide defines a standardized format for writing Git commit messages to ensure a clear, consistent, and easy-to-read project history.

---

## Commit Message Structure

```
type(scope): description

[optional body]

[optional footer(s)]
```

---

## 1. Subject Line — `type(scope): description`

The subject line is the most critical part of the commit message.

**Rules:**

- Maximum **50 characters** (hard cap: **72 characters**; aim for 50, never exceed 72)
- Written in the **imperative mood** ("add", not "adds" or "added")
- Start with a **lowercase letter**
- **No trailing period**

---

## 2. Type (Required)

A single lowercase word describing the nature of the change.

| Type | When to use |
| --- | --- |
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `style` | Formatting, whitespace, semicolons — no logic change |
| `refactor` | Code restructure that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or correcting tests |
| `build` | Changes to the build system or external dependencies (webpack, npm, Dockerfile) |
| `ci` | CI/CD configuration changes (GitHub Actions, CircleCI scripts) |
| `chore` | Housekeeping with no production code impact (`.gitignore`, editor config, repo tooling) |
| `revert` | Reverts a previous commit |

> **`build` vs `chore`:** Use `build` when changing something that affects how the project is compiled or deployed (e.g., webpack config, package.json deps). Use `chore` for everything else that doesn't touch production code (e.g., updating `.gitignore`, editor settings).

---

## 3. Scope (Optional)

A single word in parentheses specifying the part of the codebase affected.

**Examples:** `feat(api)`, `fix(auth)`, `refactor(ui)`, `docs(readme)`

**When a commit touches multiple scopes:**

- Use the most encompassing scope: `fix(auth)`
- Or omit scope entirely: `fix: correct token expiry handling`
- Do **not** list multiple scopes: ~~`fix(auth,api)`~~

---

## 4. Body (Optional)

Use the body to explain **what** changed and **why** — not how.

**Rules:**

- Separate from the subject line with a **blank line**
- Wrap lines at **72 characters**
- Use `- ` bullet points for multi-point bodies. Plain prose is acceptable
for a single continuous explanation.

---

## 5. Footer(s) (Optional)

Footers appear after the body, separated by a blank line. Common uses:

| Footer | Purpose |
| --- | --- |
| `Closes #123` | Closes a GitHub/GitLab issue |
| `Fixes #123` | Fixes a bug tracked in an issue |
| `Refs #123` | References an issue without closing it |
| `Co-authored-by: Name <email>` | Credits a co-author |
| `BREAKING CHANGE: <description>` | Signals a breaking API change |

> **Breaking changes** can also be flagged by appending `!` to the type: `feat(api)!: migrate user IDs to UUIDs`

---

## 6. WIP / Draft Commits

Work-in-progress commits on feature branches are acceptable using the `wip:` prefix. **They must never be merged into `main` or `develop` as-is.** Squash or reword before merging.

```
wip: rough draft of payment webhook handler
```

---

## Examples

### New feature

```
feat(auth): add user login with JWT
```

### Bug fix

```
fix(api): correct endpoint for user data retrieval
```

### Refactor with body

```
refactor(api): simplify user data processing logic

Removes an unnecessary loop that was introduced in the original
implementation. The refactored version uses a single reduce call,
improving both readability and performance.
```

### Refactor with bullet body

```
refactor(WorkoutLoggingBottomSheet): enhance date handling logic

- Introduced utility functions for date manipulation.
- Improved timeline anchor logic based on challenge start date.
- Updated useMemo dependencies for accurate recalculations.
- Refactored success and error handling for better clarity.
```

### Fix that closes an issue

```
fix(ui): adjust button padding on mobile devices

Closes #456
```

### Breaking change (footer style)

```
feat(api): migrate user model to use UUIDs

BREAKING CHANGE: The 'id' field for users is now a UUID string
instead of an integer. All client-side code that relies on integer
IDs must be updated.
```

### Breaking change (shorthand with `!`)

```
feat(api)!: migrate user model to use UUIDs
```

### Revert

```
revert: revert "feat(auth): add user login with JWT"

This reverts commit a1b2c3d4e5f6.
Reason: caused session conflicts in multi-device scenarios.
```

### Chore vs build

```
chore: update .gitignore to exclude .env.local
build: upgrade webpack to v5
```

### Documentation

```
docs(readme): add setup instructions for local development
```

### CI change

```
ci: add lint step to GitHub Actions workflow
```

### WIP (branch only)

```
wip: scaffolding for new notifications module
```

---

## Quick Reference Cheatsheet

```
# Format
type(scope): short description    ← max 50 chars, imperative mood

Body paragraph explaining why.    ← wrap at 72 chars
Can be multiple paragraphs.

Footer: value                     ← Closes #n, BREAKING CHANGE, etc.

# Types
feat | fix | docs | style | refactor | perf | test | build | ci | chore | revert

# Scope
Optional. Single word. Omit when change is cross-cutting.

# Breaking change
Append ! to type  →  feat(api)!: description
Or use footer     →  BREAKING CHANGE: explanation

# Revert
revert: revert "<original subject>"
This reverts commit <hash>.
```

# Concise Version

When writing Git commit messages, follow this style guide.

Format:

type(scope): description

[optional body]

[optional footer(s)]

Subject line rules:
- Keep the subject near 50 characters.
- Never exceed 72 characters.
- Use imperative mood: add, fix, update, not adds, fixed, updated.
- Start the description with a lowercase letter.
- Do not end the subject with a period.

Allowed types:
- feat: a new feature
- fix: a bug fix
- docs: documentation only
- style: formatting only, no logic change
- refactor: restructure without fixing a bug or adding a feature
- perf: performance improvement
- test: adding or correcting tests
- build: build system or dependency changes
- ci: CI/CD configuration changes
- chore: housekeeping with no production code impact
- revert: reverts a previous commit

Type guidance:
- Use build for changes that affect compiling, packaging, dependencies, or deployment.
- Use chore for repo maintenance such as .gitignore, editor config, or tooling that does not affect production code.

Scope rules:
- Scope is optional.
- Scope should be a single word in parentheses, e.g. fix(auth), feat(api), docs(readme).
- If multiple areas are touched, use the broadest useful scope or omit the scope.
- Do not use multiple scopes like fix(auth,api).

Body rules:
- Body is optional.
- Use it to explain what changed and why, not every implementation detail.
- Separate it from the subject with a blank line.
- Wrap body lines at 72 characters.
- Use - bullet points when the body has multiple distinct points.
- Plain prose is acceptable for a single continuous explanation.

Footer rules:
- Footers are optional.
- Separate footers from the body with a blank line.
- Common footers:
  - Closes #123
  - Fixes #123
  - Refs #123
  - Co-authored-by: Name <email>
  - BREAKING CHANGE: description

Breaking changes:
- Either append ! to the type/scope:
  feat(api)!: migrate user IDs to UUIDs
- Or use a footer:
  BREAKING CHANGE: The id field is now a UUID string.

WIP commits:
- wip: commits are acceptable only on local or feature branches.
- Never merge wip: commits into main or develop as-is.
- Squash or reword them before merging.

Examples:
- feat(auth): add user login with JWT
- fix(api): correct user data endpoint
- docs(readme): add local setup instructions
- ci: add lint step to GitHub Actions workflow
- chore: update .gitignore to exclude .env.local
- build: upgrade webpack to v5
- revert: revert "feat(auth): add user login with JWT"
- wip: scaffolding for new notifications module
