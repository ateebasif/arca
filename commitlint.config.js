// Commit message rules from docs/git/commit-style-guide.md (Conventional Commits).
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
        // Feature branches only; never merged as-is.
        'wip',
      ],
    ],
    'header-max-length': [2, 'always', 72],
    // Lowercase start; acronyms inside (HTML, AI) are fine.
    'subject-case': [
      2,
      'never',
      ['sentence-case', 'start-case', 'pascal-case', 'upper-case'],
    ],
    'subject-full-stop': [2, 'never', '.'],
    // A single word (or none): fix(auth), not fix(auth,api).
    'scope-case': [2, 'always', 'lower-case'],
    'scope-enum': [0],
    'body-max-line-length': [2, 'always', 72],
    'footer-max-line-length': [0],
  },
};
