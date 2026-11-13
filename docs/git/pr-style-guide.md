# Pull Request Style Guide

This guide defines a standardized format for writing GitHub Pull Request titles and bodies.
It is designed for small team review across mixed project types — features, bug fixes, refactors,
and client work.

---

## PR Title

### Format

```
type(scope): short description
```

The PR title follows the same convention as a commit subject line. Think of it as the
"headline" of the change.

**Rules:**

- Max **72 characters**
- Imperative mood ("add", "fix", "migrate" — not "adds", "fixed", "migrating")
- Lowercase after the colon
- No trailing period
- Must match or summarise the primary commit type in the branch

### Title Examples

```
feat(auth): add Google OAuth login flow
fix(api): handle null response from payment gateway
refactor(ui): extract shared button component
chore: upgrade dependencies to resolve security advisories
docs(readme): update local setup instructions
perf(db): add index on users.email for faster lookups
feat(api)!: migrate user IDs from int to UUID
```

### Breaking Changes

Append `!` to signal a breaking change directly in the title:

```
feat(api)!: replace REST endpoints with tRPC
```

---

## PR Body

Use this template for every PR. Remove sections that genuinely don't apply —
but don't skip them just because they're inconvenient to fill in.

```markdown
## What

<!-- One or two sentences. What does this PR do? -->

## Why

<!-- Why is this change needed? Link to issue, ticket, or client request. -->

## Changes

<!--
Bullet list of the meaningful changes made. Group by area if needed.
Not a repeat of the commit log — focus on what a reviewer needs to understand.
-->

-
-
-

## How to Test

<!--
Steps a reviewer can follow to verify this works. Be specific.
If it's a UI change, describe what to look for.
If it's an API change, include a sample request/response.
-->

1.
2.
3.

## Screenshots / Recordings

<!-- For UI/UX changes. Drag and drop images or a Loom link. Delete if not applicable. -->

## Checklist

- [ ] Self-reviewed the diff before opening this PR
- [ ] No console logs, debug code, or commented-out code left in
- [ ] Relevant tests added or updated
- [ ] No new lint/type errors introduced
- [ ] Breaking changes documented (migration steps, BREAKING CHANGE footer in commits)
- [ ] Reviewers and labels assigned
```

---

## Section-by-Section Guidance

### `## What`

A plain one-to-two sentence summary. Write it for someone who hasn't seen the
branch or commits. Avoid jargon.

> ✅ "Adds Google OAuth as a login option alongside existing email/password auth."
❌ "OAuth stuff."

---

### `## Why`

Explain the motivation. This is the most skipped section and the most valuable one
for future context. Link the issue or ticket number.

> ✅ "Users were dropping off at signup because we only supported email/password.
Requested by client in meeting on 12 June. Closes #88."
❌ "Feature request."

If there's a GitHub issue, use one of these closing keywords so it auto-closes on merge:

| Keyword | Effect |
| --- | --- |
| `Closes #n` | Closes the issue when PR is merged |
| `Fixes #n` | Same — preferred for bugs |
| `Resolves #n` | Same — preferred for tasks/features |
| `Refs #n` | Links without closing |

---

### `## Changes`

Not a git log dump. Write what a reviewer needs to understand the shape of the work.
Group by area if the PR is large.

```markdown
## Changes

**Auth**
- Added `GoogleOAuthProvider` to app root
- Implemented `/auth/google/callback` endpoint in NestJS
- Stored OAuth tokens in existing `sessions` table (no schema change)

**UI**
- Added "Continue with Google" button to login and signup screens
- Reused existing `SocialButton` component from `@/components/ui`
```

---

### `## How to Test`

Give exact steps. Include credentials, env vars needed, or edge cases to check.
For API changes, include a curl or HTTP example.

```markdown
## How to Test

1. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local` (see Notion creds doc)
2. Run `pnpm dev`
3. Go to `/login` and click "Continue with Google"
4. Complete the OAuth flow — you should land on `/dashboard`
5. Check the `sessions` table to confirm the record was created
6. Try logging out and back in — session should persist correctly
```

---

### `## Screenshots / Recordings`

Required for any visible UI change. Use GitHub's drag-and-drop for images.
For flows, a short Loom or screen recording is preferred over a sequence of static shots.

Before/after format works well for fixes:

```markdown
| Before | After |
|--------|-------|
| !before | !after |
```

---

### `## Checklist`

Fill this in yourself before requesting review. It signals to the team that the PR
is ready and saves back-and-forth on avoidable issues.

Adapt the checklist per project type:

**For client projects, add:**

```markdown
- [ ] Tested on staging environment
- [ ] Client-facing copy reviewed (no placeholder text)
```

**For API/breaking changes, add:**

```markdown
- [ ] Migration guide written or linked
- [ ] Dependent services / consumers notified
```

---

## PR Size Guidelines

Keep PRs small and focused. Large PRs slow reviews and hide bugs.

| Size | Lines changed | Guidance |
| --- | --- | --- |
| Small | < 200 | Ideal. Fast to review, easy to revert. |
| Medium | 200–500 | Acceptable. Use a clear `## Changes` structure. |
| Large | 500–1000 | Justify in the `## Why`. Consider splitting. |
| Too large | > 1000 | Split into a stacked PR series. |

If a PR must be large (e.g., a migration or major refactor), add a `## Context` section
explaining the structure of the diff to guide the reviewer.

---

## PR Types & When to Adjust the Template

### Feature PR

Use the full template. Screenshots required if there's any UI involved.

### Bug Fix PR

Replace `## What` with a brief description of the bug and the root cause.
Add a "Reproduction Steps" subsection under `## How to Test`.

```markdown
## What

Fixes a crash when the payment gateway returns a null `transactionId`.
Root cause: missing null check before calling `.toString()` on the response object.

## How to Test

**To reproduce the bug (before fix):**
1. Trigger a payment with a test card that returns null transaction ID (card: `4000 0000 0000 0341`)
2. Observe crash in console

**To verify the fix:**
1. Same steps — request should now complete gracefully with an error toast
```

### Refactor PR

Skip `## Screenshots`. Be explicit in `## Why` about what problem the old code had.
Include before/after code snippets in `## Changes` if the pattern shift is non-obvious.

### Chore / Dependency Update PR

Minimal template is fine. Key things to include:

- What was updated and to what version
- Why (security advisory, new feature needed, breaking change avoidance)
- Any config changes required by consumers

```markdown
## What
Upgrades `axios` from 1.3.4 → 1.7.2 to resolve CVE-2024-XXXXX.

## Changes
- Updated `axios` in `package.json`
- Adjusted response interceptor in `lib/api.ts` to match new error shape

## Checklist
- [x] Tested existing API calls — no regressions observed
- [x] Reviewed axios 1.7 changelog for breaking changes
```

### WIP / Draft PR

Open as a **Draft PR** on GitHub. Title prefix with `[WIP]` as an extra signal:

```
[WIP] feat(payments): integrate Stripe webhook handling
```

Convert to "Ready for Review" when the checklist is fully checked off.

---

## AI Agent Prompt

When generating a PR:

```
Generate a GitHub Pull Request title and body for the following work.

Branch: <branch-name>
Commits:
<paste git log --oneline output here>

Diff summary (optional):
<paste key file changes or a summary>

Follow this format:

Title: type(scope): short imperative description (max 72 chars)

Body:
## What
## Why
## Changes
## How to Test
## Screenshots / Recordings (if UI)
## Checklist

Rules:
- Imperative mood, lowercase after colon, no trailing period
- "Why" must explain motivation, not restate what
- "Changes" should be grouped by area, not a raw commit log
- "How to Test" must include exact numbered steps
- Checklist items should be pre-filled where obviously true based on the diff
```

---

## Quick Reference

```
# Title format
type(scope): short description        ← 72 char max, imperative mood
type(scope)!: description             ← breaking change

# Body sections
## What       ← 1-2 sentences, plain language
## Why        ← motivation + issue link (Closes #n / Fixes #n / Refs #n)
## Changes    ← bullet list grouped by area
## How to Test ← exact numbered steps
## Screenshots ← UI changes only
## Checklist  ← self-review before requesting review

# PR size
< 200 lines   ideal
200–500       acceptable
500–1000      justify + consider splitting
> 1000        split into stacked PRs

# Draft PRs
Title: [WIP] type(scope): description
Open as GitHub Draft until checklist is complete
```
