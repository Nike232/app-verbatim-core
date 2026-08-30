const EXPLICIT_RULES = [
  ["after-update-en", /\b(?:after|since|following)\s+(?:(?:the|an?)\s+)?(?:(?:latest|last|new|recent)\s+)?(?:app\s+)?(?:update|upgrade|release)\b/iu],
  ["app-updated-en", /\b(?:ever\s+)?since\s+(?:the\s+)?(?:app|it)\s+(?:was\s+)?updated\b/iu],
  ["named-release-en", /\b(?:this|the\s+(?:latest|last|newest)|a\s+new)\s+(?:app\s+)?(?:update(?:d)?|upgrade|release|version)\b/iu],
  ["update-required-en", /\b(?:app|application|software|screen|store)\b[^.!?\n]{0,60}\bupdate required\b/iu],
  ["repeated-updates-en", /\b(?:each|every|the\s+last\s+(?:two|three|\d+))\s+updates?\b/iu],
  ["regression-en", /\b(?:major|clear|serious|product|app|release|feature|functionality|performance|usability)?\s*regression\b/iu],
  ["named-version-number-latin", /\b(?:version|versi[oó]n|v)\s*v?\d+(?:\.\d+){1,3}\b/iu],
  ["after-version-number-en", /\b(?:after|since|following|from)\s+(?:the\s+)?(?:app\s+)?v?\d+(?:\.\d+){1,3}\b/iu],
  ["after-version-number-de", /\b(?:seit|nach)\s+(?:dem\s+)?v?\d+(?:\.\d+){1,3}\b/iu],
  ["after-version-number-fr", /\b(?:depuis|apr[eè]s)\s+(?:la\s+)?v?\d+(?:\.\d+){1,3}\b/iu],
  ["after-version-number-es", /\b(?:desde|despu[eé]s de)\s+(?:la\s+)?v?\d+(?:\.\d+){1,3}\b/iu],
  ["named-version-number-zh", /(?:版本\s*v?\d+(?:\.\d+){1,3}|v?\d+(?:\.\d+){1,3}\s*版本)/iu],
  ["named-version-number-ja", /(?:バージョン\s*v?\d+(?:\.\d+){1,3}|v?\d+(?:\.\d+){1,3}\s*(?:以降|から))/iu],
  ["release-de", /\b(?:(?:seit|nach)\s+(?:(?:dem|einem)\s+)?(?:(?:letzten|neuesten|neuen)\s+)?(?:update|upgrade)|(?:diese[rmns]?|neue[rmns]?|letzte[rmns]?|neueste[rmns]?)\s+(?:version|update))\b/iu],
  ["release-fr", /\b(?:(?:depuis|apr[eè]s)\s+(?:la\s+)?(?:derni[eè]re|nouvelle|r[eé]cente)?\s*(?:mise [aà] jour|version)|cette\s+(?:mise [aà] jour|version))\b/iu],
  ["release-es", /\b(?:(?:desde|despu[eé]s de)\s+(?:la\s+)?(?:[uú]ltima|nueva|reciente)?\s*(?:actualizaci[oó]n|versi[oó]n)|esta\s+(?:actualizaci[oó]n|versi[oó]n))\b/iu],
  ["release-zh", /(?:更新|升级)(?:后|以后|之后)|(?:这个|此|新|最新)(?:版本|更新)|自从(?:更新|升级)/u],
  ["release-ja", /(?:アップデート|更新)(?:後|してから|以降)|(?:この|新しい|最新の)(?:バージョン|アップデート)/u]
];

const CHANGE_RULES = [
  ["used-to-en", /\bused\s+to\b/iu],
  ["no-longer-en", /\b(?:can|could)\s+no\s+longer\b|\bno\s+longer\s+(?:works?|opens?|loads?|syncs?|sends?|receives?|notifies?|allows?|supports?|connects?|starts?|launches?|signs?|logs?)\b|\b(?:won['’]?t|can['’]?t|cannot|doesn['’]?t|don['’]?t)\s+(?:open|load|sync|send|receive|notify|access|connect|start|launch|sign\s*in|log\s*in|work)\b[^.!?\n]{0,60}\banymore\b/iu],
  ["sudden-change-en", /\bsuddenly\b/iu],
  ["recent-change-en", /\brecently\b/iu],
  ["worsening-en", /\b(?:getting|got|became|becoming|keeps?\s+getting)\s+(?:much\s+|even\s+)?worse\b/iu],
  ["changed-behavior-en", /\b(?:behavior|behaviour|interface|layout|design|navigation|notifications?|sync|autofill)\b[^.!?\n]{0,40}\bchanged\b/iu],
  ["change-de", /\b(?:pl[oö]tzlich|nicht mehr|fr[uü]her|inzwischen)\b/iu],
  ["change-fr", /\b(?:soudainement|r[eé]cemment|ne\b[^.!?\n]{0,60}\bplus|avant\b[^.!?\n]{0,80}\bmaintenant)\b/iu],
  ["change-es", /\b(?:de repente|recientemente|ya no|antes\b[^.!?\n]{0,80}\bahora)\b/iu],
  ["change-zh", /(?:突然|最近|不再|以前.{0,40}现在|越来越(?:差|慢|卡))/u],
  ["change-ja", /(?:突然|以前.{0,40}(?:今|現在)|できなくな|使えなくな|最近)/u]
];

export function classifyReleaseLink(review) {
  const text = `${review?.title ?? ""} ${review?.body ?? review?.text ?? ""}`.replace(/\s+/g, " ").trim();
  const explicitHits = matchingRuleIds(text, EXPLICIT_RULES);
  const changeHits = matchingRuleIds(text, CHANGE_RULES);
  return {
    kind: explicitHits.length ? "explicit" : changeHits.length ? "change" : "none",
    explicitHits,
    changeHits
  };
}

function matchingRuleIds(text, rules) {
  return rules.filter(([, pattern]) => pattern.test(text)).map(([id]) => id);
}
