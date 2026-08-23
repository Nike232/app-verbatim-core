import { normalizeReview } from "../analysis.js";
import { defineConnector } from "../connector-registry.js";

const templates = [
  [1, "The app crashes every time I open the analytics tab after version 4.8.", "stability"],
  [2, "Sync stopped working after the update and my saved project disappeared.", "sync"],
  [1, "Subscription price doubled and the restore purchase button does nothing.", "pricing"],
  [2, "Notifications arrive hours late, so reminders are no longer useful.", "notifications"],
  [3, "The new navigation is confusing. I cannot find exports anymore.", "usability"],
  [4, "Please add CSV export and a weekly email summary for the team.", "request"],
  [2, "Login verification code never arrives when I use a custom email domain.", "account"],
  [1, "Battery drain is severe and the phone gets hot while syncing.", "performance"],
  [5, "Clean interface and the new search is much faster. Great update.", "praise"],
  [4, "Would love filters by version and country in the next release.", "request"],
  [2, "The app freezes on launch unless I reinstall it.", "stability"],
  [3, "Too many permission prompts before I can try the product.", "privacy"]
];

export const demoConnector = defineConnector({
  id: "demo",
  name: "Deterministic offline demo",
  version: "1",
  supports: (source) => source?.store === "demo",
  fetch: (source, options = {}) => Promise.resolve(source?.appId === "competitor" ? createDemoCompetitorDataset(options.limit) : createDemoDataset(options.limit))
});

export function createDemoDataset(limit = 96) {
  const count = clamp(limit, 1, 500);
  const anchor = Date.parse("2026-08-23T09:00:00.000Z");
  const reviews = Array.from({ length: count }, (_, index) => {
    const [rating, text, tag] = templates[index % templates.length];
    const recentStability = index < 18 && index % 3 === 0;
    return normalizeReview({
      source: "google-play",
      appId: "com.demo.pulse",
      reviewId: `demo-${index + 1}`,
      title: tag === "praise" ? "A thoughtful update" : null,
      body: recentStability ? `${text} This regression started with 4.8.0.` : text,
      rating: recentStability ? Math.min(rating, 2) : rating,
      language: "en",
      country: ["US", "GB", "CA", "AU"][index % 4],
      appVersion: index < 36 ? "4.8.0" : index < 68 ? "4.7.2" : "4.6.9",
      author: `Sample user ${index + 1}`,
      helpfulCount: (index * 7) % 43,
      sourceUrl: "https://play.google.com/store/apps/details?id=com.demo.pulse",
      createdAt: new Date(anchor - index * 1.8 * 86_400_000).toISOString()
    });
  });
  return {
    app: { id: "com.demo.pulse", name: "Pulse Notes", icon: null, developer: "Northstar Studio", url: "https://play.google.com/store/apps/details?id=com.demo.pulse", store: "google-play" },
    reviews,
    metadata: { connector: "demo", connectorVersion: "1", fixture: true, scenario: "4.8 stability regression" }
  };
}

export function createDemoCompetitorDataset(limit = 84) {
  const base = createDemoDataset(limit ?? 84);
  const replacements = [
    "The subscription is too expensive and every useful feature is behind a paywall.",
    "I was charged after cancelling the trial and support would not refund it.",
    "Please add a monthly plan. The annual subscription is too expensive.",
    "The price keeps increasing but basic export still requires another payment."
  ];
  return {
    app: { id: "com.demo.orbit", name: "Orbit Journal", icon: null, developer: "Orbit Labs", url: "https://play.google.com/store/apps/details?id=com.demo.orbit", store: "google-play" },
    reviews: base.reviews.map((review, index) => ({
      ...review,
      appId: "com.demo.orbit",
      reviewId: `competitor-${index + 1}`,
      body: index % 3 === 0 ? replacements[index % replacements.length] : review.body.replaceAll("4.8.0", "7.2.0"),
      rating: index % 3 === 0 ? 1 : review.rating,
      appVersion: index < 30 ? "7.2.0" : "7.1.4",
      sourceUrl: "https://play.google.com/store/apps/details?id=com.demo.orbit"
    })),
    metadata: { connector: "demo", connectorVersion: "1", fixture: true, scenario: "competitor pricing complaints" }
  };
}

function clamp(value, min, max) {
  const number = Number.parseInt(value ?? "", 10);
  return Number.isInteger(number) ? Math.min(max, Math.max(min, number)) : 96;
}
