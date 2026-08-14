# Contributing to OpenTile

Thanks for helping improve OpenTile.

## Local development

1. Clone the repository: `git clone <repo-url>`.
2. Install Node dependencies with `npm ci`.
3. Run `npm run dev -- --host 127.0.0.1` to start the editor at `http://localhost:5173`.

## Before opening a pull request

- Keep each change focused and update affected documentation.
- Run `npm test`.
- For editor interactions, verify the flow manually in the browser and include a screenshot or recording when the UI changes.
- Do not commit generated exports, local browser data, or credentials.

## Reporting bugs and requesting features

Use the GitHub issue templates and include reproduction steps, expected behavior, actual behavior, and environment details. For security issues, follow [SECURITY.md](SECURITY.md) instead.

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
