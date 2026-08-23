# Contributing

Thanks for helping improve App Verbatim Core. The best first contributions are connector fixtures, parsing fixes, language coverage, deterministic analysis tests, and documentation corrections.

## Setup

```bash
git clone https://github.com/Nike232/app-verbatim-core.git
cd app-verbatim-core
npm ci
npm run check
```

Use a focused branch and include tests for behavior changes. Offline fixtures must be synthetic or irreversibly anonymized; do not commit scraped user datasets, access tokens, session cookies, proxy credentials, or customer information.

## Pull-request requirements

- Explain the user-visible behavior and compatibility impact.
- Keep the analysis deterministic unless the API explicitly says otherwise.
- Add an offline test for every bug fix and connector normalization change.
- Preserve evidence links between findings and source reviews.
- Update type declarations and documentation when an exported API changes.
- Run `npm run check` locally.

By contributing, you agree that your contribution is licensed under AGPL-3.0-or-later and may be offered by the project under separate commercial terms. You represent that you have the right to submit it.

Use GitHub Discussions or an issue for design proposals before a large change. Security reports must follow [SECURITY.md](SECURITY.md).
