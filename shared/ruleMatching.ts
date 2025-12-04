import type { UrlRule } from "./schema";
import { RULE_MATCHING_CONFIG } from "./constants";

/**
 * Rule matching and prioritization helper.
 * Rules are loaded from server/storage.ts via getUrlRules().
 * Normalization, matching and specificity scoring occur here.
 */

export interface RuleMatchingConfig {
  WEIGHT_PATH_SEGMENT: number;
  WEIGHT_QUERY_PAIR: number;
  PENALTY_WILDCARD: number;
  BONUS_EXACT_MATCH: number;
  TRAILING_SLASH_POLICY: "ignore" | "strict";
  CASE_SENSITIVITY_PATH: boolean;
  CASE_SENSITIVITY_QUERY: boolean;
  DEBUG?: boolean;
}

export interface ProcessedUrlRule extends UrlRule {
  normalizedPath: string[];
  normalizedQuery: Map<string, string[]>;
}

export interface MatchDetails {
  rule: UrlRule;
  score: number;
  quality: number; // 0-100
  level: 'red' | 'yellow' | 'green';
  matchStartIndex: number;
  matchLength: number;
  debug?: {
    hasExtraQuery: boolean;
    isExact: boolean;
  };
}

export function normalizePath(path: string, cfg: RuleMatchingConfig): string[] {
  // Remove fragment and normalize slashes
  const url = new URL(path, "http://example.com");
  let pathname = url.pathname;
  if (cfg.TRAILING_SLASH_POLICY === "ignore") {
    pathname = pathname.replace(/\/+$/, "");
  }
  pathname = pathname.replace(/\/+/g, "/");
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .map((seg) => decodeURIComponent(seg));
  if (!cfg.CASE_SENSITIVITY_PATH) {
    return segments.map((s) => s.toLowerCase());
  }
  return segments;
}

export function normalizeQuery(
  query: string,
  cfg: RuleMatchingConfig,
): Map<string, string[]> {
  const params = new URLSearchParams(query);
  const map = new Map<string, string[]>();
  for (const [key, value] of params.entries()) {
    const normKey = cfg.CASE_SENSITIVITY_QUERY ? key : key.toLowerCase();
    if (!map.has(normKey)) map.set(normKey, []);
    map.get(normKey)!.push(decodeURIComponent(value));
  }
  for (const [key, arr] of map) {
    arr.sort();
  }
  return map;
}

export function preprocessRule(rule: UrlRule, config: RuleMatchingConfig): ProcessedUrlRule {
  const [matcherPath, matcherQuery] = rule.matcher.split("?");
  return {
    ...rule,
    normalizedPath: normalizePath(matcherPath, config),
    normalizedQuery: normalizeQuery(matcherQuery ? "?" + matcherQuery : "", config),
  };
}

function isProcessedRule(rule: UrlRule | ProcessedUrlRule): rule is ProcessedUrlRule {
  return 'normalizedPath' in rule && 'normalizedQuery' in rule;
}

export function findMatchingRule(
  requestUrl: string,
  rules: UrlRule[] | ProcessedUrlRule[],
  config: RuleMatchingConfig = RULE_MATCHING_CONFIG,
): MatchDetails | null {
  const reqUrl = new URL(requestUrl, "http://example.com");
  const reqPath = normalizePath(reqUrl.pathname, config);
  const reqQuery = normalizeQuery(reqUrl.search, config);

  let best: {
    rule: UrlRule;
    score: number;
    staticSegments: number;
    queryPairs: number;
    wildcards: number;
    start: number;
    ruleQuery: Map<string, string[]>;
  } | null = null;

  for (const rule of rules) {
    let rulePath: string[];
    let ruleQuery: Map<string, string[]>;

    if (isProcessedRule(rule)) {
      rulePath = rule.normalizedPath;
      ruleQuery = rule.normalizedQuery;
    } else {
      const [matcherPath, matcherQuery] = rule.matcher.split("?");
      rulePath = normalizePath(matcherPath, config);
      // Pre-check length to avoid unnecessary query processing
      if (rulePath.length > reqPath.length) continue;

      ruleQuery = normalizeQuery(
        matcherQuery ? "?" + matcherQuery : "",
        config,
      );
    }

    if (rulePath.length > reqPath.length) continue;

    for (let start = 0; start <= reqPath.length - rulePath.length; start++) {
      // Path matching
      let staticMatches = 0;
      let wildcards = 0;
      let pathMismatch = false;
      for (let i = 0; i < rulePath.length; i++) {
        const seg = rulePath[i];
        const reqSeg = reqPath[start + i];
        if (seg === "*" || seg.startsWith(":")) {
          wildcards++;
          continue;
        }
        // Partial wildcard support (e.g. "prefix*")
        if (seg.endsWith("*") && seg.length > 1) {
          const prefix = seg.slice(0, -1);
          if (reqSeg.startsWith(prefix)) {
             wildcards++; // Treat as wildcard for scoring
             continue;
          }
        }

        if (seg === reqSeg) {
          staticMatches++; // Exact segment match: full weight (1.0)
        } else if (reqSeg.startsWith(seg)) {
          // Implicit prefix match (e.g. rule "/team" matches request "/teamwork")
          // We count this as a match for the segment count (so we consume the segment),
          // but we give it slightly less weight in the score calculation to prioritize exact matches.
          // Since staticMatches is used for BOTH scoring AND length, we must keep it as integer (1)
          // but adjust the score separately.
          // Wait, 'staticMatches' variable is used for score calculation below: `staticMatches * WEIGHT`.
          // If we want less weight, we cannot simply increment by 1.
          // Let's split the concepts: `matchedSegmentsCount` vs `score`.
          // Refactoring loop state:
          staticMatches += 0.9; // Using float for scoring distinction
        } else {
          pathMismatch = true;
          break;
        }
      }
      if (pathMismatch) continue;

      // Query matching
      let queryPairs = 0;
      let queryMismatch = false;
      for (const [key, vals] of ruleQuery) {
        const reqVals = reqQuery.get(key);
        if (!reqVals) {
          queryMismatch = true;
          break;
        }
        for (const v of vals) {
          if (!reqVals.includes(v)) {
            queryMismatch = true;
            break;
          }
          queryPairs++;
        }
        if (queryMismatch) break;
      }
      if (queryMismatch) continue;

      // Exact match bonus
      let exact = false;
      if (
        start === 0 &&
        rulePath.length === reqPath.length &&
        ruleQuery.size === reqQuery.size
      ) {
        exact = true;
      }

      const score =
        staticMatches * config.WEIGHT_PATH_SEGMENT +
        queryPairs * config.WEIGHT_QUERY_PAIR +
        wildcards * config.PENALTY_WILDCARD +
        (exact ? config.BONUS_EXACT_MATCH : 0);

      if (config.DEBUG) {
        console.debug(
          `Rule ${rule.matcher} -> score=${score}, static=${staticMatches}, query=${queryPairs}, wildcards=${wildcards}, exact=${exact}`,
        );
      }

      if (
        !best ||
        score > best.score ||
        (score === best.score && start < best.start) || // Prioritize matches that start earlier in the path
        (score === best.score && start === best.start && staticMatches > best.scoreComponents.staticMatches) || // Compare scores
        // Specificity Tie-Breaker: Matcher Length
        // If scores are equal, but one rule has a longer matcher string, it is more specific.
        // e.g. "/sample-full" vs "/sample" matching "/sample-full". Both match. Both start at 0.
        // "/sample-full" (longer) should win.
        (score === best.score && start === best.start && rule.matcher.length > best.rule.matcher.length) ||

        (score === best.score &&
          start === best.start &&
          staticMatches === best.scoreComponents.staticMatches && // Compare float scores for equality
          queryPairs > best.queryPairs) ||
        (score === best.score &&
          start === best.start &&
          staticMatches === best.scoreComponents.staticMatches &&
          queryPairs === best.queryPairs &&
          wildcards < best.wildcards) ||
        (score === best.score &&
          start === best.start &&
          staticMatches === best.scoreComponents.staticMatches &&
          queryPairs === best.queryPairs &&
          wildcards === best.wildcards &&
          (rule.createdAt || "") < (best.rule.createdAt || "")) ||
        (score === best.score &&
          start === best.start &&
          staticMatches === best.scoreComponents.staticMatches &&
          queryPairs === best.queryPairs &&
          wildcards === best.wildcards &&
          (rule.createdAt || "") === (best.rule.createdAt || "") &&
          rule.id < best.rule.id)
      ) {
        best = {
          rule,
          score,
          // We need to store the integer segment count for length calculation,
          // but we only have the float `staticMatches`.
          // However, wildcards are integers. `rulePath.length` is the total segments.
          // Since we matched the whole rule path (loop completed),
          // the number of matched segments IS `rulePath.length`.
          // We don't need to rely on `staticMatches` accumulation for length.
          matchedSegmentCount: rulePath.length,
          queryPairs,
          wildcards,
          start,
          ruleQuery,
          scoreComponents: { staticMatches } // Store the score component for comparison
        };
      }
    }
  }

  if (!best) return null;

  // Calculate Match Quality
  let quality = 100;
  const start = best.start;
  // Use the explicit segment count derived from rule length
  const matchLength = best.matchedSegmentCount;
  const ruleQuery = best.ruleQuery;

  // Check for extra query params
  let hasExtraQuery = false;
  for (const key of reqQuery.keys()) {
    if (!ruleQuery.has(key)) {
      hasExtraQuery = true;
      break;
    }
  }

  // Check if it's a deep partial match (rule found in middle of path)
  // If start > 0, it means the rule matched starting at a later segment (substring match)
  // If (staticSegments + wildcards) < reqPath.length, it means the rule is shorter than the requested path (prefix match)
  const rulePathLength = best.staticSegments + best.wildcards;
  if (start > 0 || rulePathLength < reqPath.length) {
    quality = 50;
  } else if (hasExtraQuery) {
    quality = 75;
  }
  // Default is 100 (start === 0 && !hasExtraQuery)

  let level: 'red' | 'yellow' | 'green' = 'green';
  if (quality < 60) level = 'red'; // Changed 50% to red based on user requirement "Red is when only the main url is replaced"
  if (quality >= 60 && quality < 90) level = 'yellow'; // 75%
  if (quality >= 90) level = 'green'; // 100%

  return {
    rule: best.rule,
    score: best.score,
    quality,
    level,
    matchStartIndex: start,
    matchLength: matchLength,
    debug: {
        hasExtraQuery,
        isExact: start === 0 && !hasExtraQuery && best.staticSegments === reqPath.length
    }
  };
}

export function selectMostSpecificRule(
  requestUrl: string,
  rules: UrlRule[] | ProcessedUrlRule[],
  config: RuleMatchingConfig = RULE_MATCHING_CONFIG,
): UrlRule | null {
  const match = findMatchingRule(requestUrl, rules, config);
  return match ? match.rule : null;
}

/**
 * Constructs the target URL based on the match details and the original request URL.
 * This ensures consistency between rule matching and URL generation.
 */
export function constructTargetUrl(
  requestUrl: string,
  matchDetails: MatchDetails | null,
  defaultNewDomain: string,
  config: RuleMatchingConfig = RULE_MATCHING_CONFIG
): string {
  // If no match, fallback to domain replacement
  if (!matchDetails) {
    // Basic domain replacement logic
    const u = new URL(requestUrl, "http://example.com");
    // Ensure we use the full path including search and hash
    // If requestUrl was absolute, use its path. If relative, use as is.

    // We need to handle potential relative URLs or absolute URLs
    // Let's assume requestUrl can be full or relative path
    let path = u.pathname + u.search + u.hash;

    // If requestUrl was actually full URL, we might want to respect that?
    // But usually we just take the path/query/hash and append to defaultNewDomain

    // Clean defaultNewDomain
    const base = defaultNewDomain.replace(/\/$/, "");
    return base + path;
  }

  const { rule, matchStartIndex, matchLength } = matchDetails;

  // Note: UrlRule schema uses `redirectType: "wildcard" | "partial"`
  // "wildcard" corresponds to "COMPLETE" mode logic in this context
  if (rule.redirectType === "wildcard") {
    // Complete mode: completely replace with targetUrl
    // If targetUrl is relative, prepend the default new domain
    const target = rule.targetUrl!;
    if (!target.match(/^https?:\/\//) && !target.startsWith('//')) {
      const base = defaultNewDomain.replace(/\/$/, "");
      const path = target.startsWith('/') ? target : '/' + target;
      return base + path;
    }
    return target;
  }

  // Partial mode
  // We need to reconstruct the path based on the match
  const reqUrl = new URL(requestUrl, "http://example.com");

  // We want to preserve the original casing of the request segments for the output,
  // even if matching was case-insensitive.
  // So we parse the request path with case sensitivity forced to true.
  const outputConfig = { ...config, CASE_SENSITIVITY_PATH: true };
  const reqPathSegments = normalizePath(reqUrl.pathname, outputConfig);

  // Use explicit match details from finding process
  const start = matchStartIndex;

  // Construct new path
  // Segments before match
  const prefixSegments = reqPathSegments.slice(0, start);

  // Segments after match
  const suffixSegments = reqPathSegments.slice(start + matchLength);

  // Target path from rule
  const targetPath = rule.targetUrl || "";
  // Ensure target path is clean (no leading/trailing slashes if we are joining)
  // But wait, targetUrl might be absolute or relative path?
  // Schema says targetUrl for PARTIAL is usually a path.

  // If targetUrl is absolute, we should probably treat it as a new base?
  // But PARTIAL usually implies path replacement.

  // Let's assume targetUrl is a path.
  // We must NOT normalize casing for the target path, as it dictates the output.
  // We use a temporary config forcing case sensitivity for the target path processing.
  const targetConfig = { ...config, CASE_SENSITIVITY_PATH: true };
  const targetPathSegments = normalizePath(targetPath, targetConfig); // This strips slashes but keeps case

  // Combine: Prefix + Target + Suffix
  const newPathSegments = [...prefixSegments, ...targetPathSegments, ...suffixSegments];

  const newPath = "/" + newPathSegments.join("/");

  // Base Domain
  const base = defaultNewDomain.replace(/\/$/, "");

  // Append Query and Hash from original request
  // (Unless they were part of the match? The logic says "additional segments, parameters and anchors are appended")
  // For parameters: we preserve all parameters unless we want to filter them?
  // The current simple logic preserves all.

  return base + newPath + reqUrl.search + reqUrl.hash;
}
