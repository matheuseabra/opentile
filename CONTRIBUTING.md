# Contributing to OpenTile

Thanks for helping improve OpenTile.

## Local development

1. Clone the repository with its submodule: `git clone --recurse-submodules <repo-url>`.
2. Install Node dependencies with `npm ci`.
3. Install the prerequisites listed in the [README](README.md#run-locally), then run `./run.sh`.

`./run.sh` provisions the local Python environment, applies the tracked portability patch to the bundled pixel-art fixer, builds it when needed, and starts the editor at `http://localhost:5173`.

## Before opening a pull request

- Keep each change focused and update affected documentation.
- Run `npm run build` and `npm test`.
- For editor interactions, verify the flow manually in the browser and include a screenshot or recording when the UI changes.
- Do not commit generated exports, local browser data, credentials, or changes inside the `vendor/pixel-art-fixer` submodule. Update the tracked patch only when a portability fix is necessary.

## Reporting bugs and requesting features

Use the GitHub issue templates and include reproduction steps, expected behavior, actual behavior, and environment details. For security issues, follow [SECURITY.md](SECURITY.md) instead.

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
