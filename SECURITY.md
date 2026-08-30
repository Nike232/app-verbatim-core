# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| Latest GitHub release | Yes |
| Older releases and moving-tag history | No |

Security fixes are released from the current `0.x` line. Consumers using the moving `v0` GitHub Action tag receive the latest compatible release; security-sensitive deployments should pin the latest immutable full release tag and update promptly.

## Reporting a vulnerability

Do not disclose suspected vulnerabilities in a public issue. Use GitHub's private vulnerability reporting for `Nike232/app-verbatim-core`. Include the affected version, reproduction, impact, and any suggested mitigation. If private reporting is unavailable, open a minimal issue asking the maintainer to enable a private contact channel without including exploit details.

Never send store-console credentials, session cookies, API keys, proxy passwords, customer reviews, or a production database in a report.

The project will acknowledge a valid report when maintainers are available, investigate it, prepare a coordinated fix, and credit the reporter if requested. No fixed response-time SLA is offered by the community project.

## Deployment guidance

Supported deployments should run a maintained Node.js release and a lockfile-clean `npm ci`. Public-store connectors process untrusted remote data; consumers must escape text before rendering it. The bundled HTML and CSV exporters do this by default.
