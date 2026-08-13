# Security policy

## Supported versions

Security fixes are applied to the latest version on `main`.

## Reporting a vulnerability

Please **do not** open a public issue for a suspected vulnerability. Report it privately by emailing [matheuseabra@protonmail.com](mailto:matheuseabra@protonmail.com) with a description, reproduction steps, and potential impact.

You should receive an acknowledgment within seven days. Please allow time for a fix and coordinated disclosure before sharing details publicly.

OpenTile's local processing bridge binds to `127.0.0.1` only. Do not expose it directly to a network without adding authentication, stricter request parsing, and content validation.
