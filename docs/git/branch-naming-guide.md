# Branch Naming Guide

This guide defines a standardized format for naming Git branches across all projects.
It follows the **Gitflow** model with optional issue number support.

---

## Branch Structure

```
category/issue-description
```

- `category` — the type of work (see table below)
- `issue` — optional GitHub issue number (e.g. `88-`)
- `description` — kebab-case summary of the work, 2–5 words

**All lowercase. Hyphens only. No slashes inside the description. No special characters.**

---

## Categories

| Category | Based on | Merges into | When to use |
| --- | --- | --- | --- |
| `feature/` | `develop` | `develop` | New functionality |
| `fix/` | `develop` | `develop` | Bug fix during normal development |
| `hotfix/` | `main` | `main` + `develop` | Critical production bug requiring immediate fix |
| `release/` | `develop` | `main` + `develop` | Preparing a new release (version bump, final fixes) |
| `refactor/` | `develop` | `develop` | Code restructure with no behaviour change |
| `chore/` | `develop` | `develop` | Tooling, config, dependencies, housekeeping |
| `docs/` | `develop` | `develop` | Documentation only |
| `test/` | `develop` | `develop` | Adding or fixing tests |
| `experiment/` | `develop` | never (may be deleted) | Spike or proof-of-concept — not guaranteed to merge |

---

## Naming Rules

1. **Lowercase only** — `feature/add-login` not `feature/AddLogin`
2. **Hyphens to separate words** — `fix/null-payment-response` not `fix/null_payment_response`
3. **2–5 words in the description** — short enough to read in a branch list
4. **No trailing hyphens or double hyphens**
5. **No personal names or initials** — branch names describe work, not people
6. **No vague names** — `feature/updates` or `fix/bug` are not acceptable

---

## With Issue Numbers (Optional)

When a branch maps to a GitHub issue, prefix the description with the issue number
followed by a hyphen. This creates a clickable link in GitHub's UI and makes
`git log` easier to trace.

```
category/88-description-of-work
```

Use issue numbers when:

- The branch was created from a GitHub Issue
- The work is part of a tracked milestone or sprint

Omit issue numbers when:

- It's a quick chore, docs update, or internal refactor with no issue
- It's experimental/spike work

---

## Examples

### Feature branches

```
feature/google-oauth-login
feature/88-google-oauth-login       ← with issue number
feature/payment-webhook-handler
feature/export-csv-report
```

### Fix branches

```
fix/null-transaction-id-crash
fix/112-cart-total-rounding-error   ← with issue number
fix/auth-token-expiry
```

### Hotfix branches (off main)

```
hotfix/stripe-webhook-500-error
hotfix/login-redirect-loop
```

### Release branches

```
release/1.4.0
release/2.0.0-beta
```

### Refactor branches

```
refactor/extract-button-component
refactor/simplify-user-data-pipeline
```

### Chore branches

```
chore/upgrade-axios-security-patch
chore/update-env-example
chore/remove-unused-dependencies
```

### Docs branches

```
docs/update-api-setup-instructions
docs/add-contributing-guide
```

### Experiment branches

```
experiment/graphql-federation-spike
experiment/ai-search-poc
```

---

## Gitflow Branch Map

```
main
 └── hotfix/critical-fix           → merges into main + develop

develop
 ├── feature/new-feature           → merges into develop
 ├── fix/some-bug                  → merges into develop
 ├── refactor/some-module          → merges into develop
 ├── chore/some-task               → merges into develop
 └── release/1.4.0                 → merges into main + develop
```

> **Never branch directly off `main`** except for `hotfix/` and `release/`.
**Never commit directly to `main` or `develop`.** Always use a branch + PR.

---

## What to Avoid

| ❌ Bad | ✅ Good | Why |
| --- | --- | --- |
| `feature/AddGoogleLogin` | `feature/add-google-login` | No camelCase |
| `fix/bug` | `fix/null-payment-response` | Too vague |
| `ateeb/new-stuff` | `feature/user-notification-system` | No personal names |
| `feature/updates` | `feature/upgrade-axios-to-v5` | Too vague |
| `feature/add-the-new-google-oauth-login-flow-for-mobile` | `feature/google-oauth-mobile` | Too long |
| `HOTFIX/login` | `hotfix/login-redirect-loop` | No uppercase |
| `feature/new_feature` | `feature/new-feature` | No underscores |

---

## AI Agent Prompt

When suggesting a branch name:

```
Suggest a Git branch name for the following work.

Task description: <describe what you're about to build or fix>
Issue number (if any): <#n or leave blank>
Type of work: <feature / fix / hotfix / refactor / chore / docs / test / experiment>

Rules:
- Format: category/[issue-]short-description
- Lowercase, hyphens only, 2–5 words in description
- No personal names, no vague words like "update" or "fix" alone
- Branching model is Gitflow — feature/fix/refactor/chore branch off develop,
  hotfix branches off main
```

---

## Quick Reference

```
# Format
category/description
category/issue-description     ← with GitHub issue number

# Categories
feature/    → new functionality          (off develop)
fix/        → bug fix                    (off develop)
hotfix/     → critical production fix    (off main)
release/    → release prep               (off develop)
refactor/   → restructure, no behaviour change
chore/      → tooling, deps, config
docs/       → documentation only
test/       → tests only
experiment/ → spike / poc, may not merge

# Rules
✓ lowercase only
✓ hyphens between words
✓ 2–5 words in description
✗ no camelCase or underscores
✗ no personal names or initials
✗ no vague names (fix/bug, feature/updates)
✗ never branch off main except hotfix/ and release/
```
