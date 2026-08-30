# Real-app release cohort

`release-cohort.json` defines a diverse set of 20 public Google Play applications used to challenge the default release-regression policy against live data. It covers security, communication, browsers, cloud storage, productivity, work, reference, media, social, education, and travel.

Run the aggregate validation with:

```bash
npm run validate:cohort
```

The command fetches each app sequentially, applies the public default policy, and writes `reports/release-cohort.json`. That report contains only app-level counts, selected versions, metric changes, violation identifiers, and errors. It deliberately excludes review text, authors, and review identifiers, and `reports/` is gitignored.

Use `npm run validate:cohort -- --app bitwarden` for one cohort member. `npm run check:cohort` validates the committed manifest without making network requests.

## What this benchmark can establish

- Whether the default policy can reach a decision with the review volume returned by the public connector.
- Which signal types dominate live failures.
- Whether connector errors or under-sampled newest releases prevent useful decisions.
- Which failing cases need human evidence review before any threshold change.

It cannot establish precision or recall by itself. Live store data changes, and a policy failure is not automatically a true product regression. Maintainers must adjudicate the source evidence for each failure and record timestamped aggregate conclusions without committing review content.

## Snapshot: 2026-08-30

Two consecutive runs against the US English storefront returned identical versions, counts, metrics, and statuses for all 20 applications:

| Outcome | Apps | Count |
| --- | --- | ---: |
| Pass | Signal, DuckDuckGo, Dropbox, Spotify, Reddit, Duolingo, Airbnb | 7 |
| Evidence-backed fail | Bitwarden, Microsoft Teams, Discord, Telegram | 4 |
| Insufficient newest-version sample | Firefox, Nextcloud, Notion, Todoist, Trello, Evernote, Slack, Wikipedia, VLC | 9 |
| Connector error | — | 0 |

The policy reached a decision for 11 of 20 apps (`55%`). All nine inconclusive results were caused by the actual newest version having fewer than 10 reviews; none lacked a usable earlier candidate. A focused rerun showed, for example, that Notion had 9 newest-version reviews and therefore needed exactly one more before comparison.

Every failure combined a rating drop with a low-rating-share increase. Human evidence review found actionable, repeated complaints in all four failing cases:

- Bitwarden: passkey, biometric unlock, and autofill failures.
- Microsoft Teams: sign-in failures, stuck connections, and missing notifications.
- Discord: update-related interface, voice-call, freezing, and account-creation failures.
- Telegram: sign-up or SMS fees and verification or login failures.

This is an actionability adjudication of the four observed failures, not a population precision claim. The cohort does not label passes for hidden regressions and covers only one storefront, language, and point in time.
