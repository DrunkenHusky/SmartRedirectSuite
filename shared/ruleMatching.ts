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
  isDomainMatcher: boolean;
  hostname?: string;
}

export interface MatchDetails {
  rule: UrlRule;
  score: number;
  quality: number; // 0-100
  level: 'red' | 'yellow' | 'green';
  debug?: {
    start: number;
    hasExtraQuery: boolean;
    isExact: boolean;
  };
}

export function normalizePath(path: string, cfg: RuleMatchingConfig): string[] {
  // Remove fragment and normalize slashes
  // If path is empty or just /, return empty array for root
  if (!path || path === '/') return [];

  const url = new URL(path.startsWith('/') ? path : '/' + path, "http://example.com");
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

/**
 * Parses the matcher string to extract domain, path segments, and query params.
 * Handles both standard path matchers (starting with /) and domain matchers (starting with host).
 */
function parseMatcher(matcher: string, config: RuleMatchingConfig): {
    normalizedPath: string[];
    normalizedQuery: Map<string, string[]>;
    isDomainMatcher: boolean;
    hostname?: string;
} {
    const [matcherPart, matcherQuery] = matcher.split("?");
    const isDomainMatcher = !matcherPart.startsWith('/');

    let normalizedPath: string[] = [];
    let hostname: string | undefined = undefined;

    if (isDomainMatcher) {
        try {
            const slashIndex = matcherPart.indexOf('/');
            if (slashIndex !== -1) {
                hostname = matcherPart.substring(0, slashIndex).toLowerCase();
                const pathPart = matcherPart.substring(slashIndex);
                normalizedPath = normalizePath(pathPart, config);
            } else {
                hostname = matcherPart.toLowerCase();
                normalizedPath = []; // Root path
            }
        } catch (e) {
            hostname = matcherPart.toLowerCase();
            normalizedPath = [];
        }
    } else {
        normalizedPath = normalizePath(matcherPart, config);
    }

    const normalizedQuery = normalizeQuery(matcherQuery ? "?" + matcherQuery : "", config);

    return { normalizedPath, normalizedQuery, isDomainMatcher, hostname };
}

export function preprocessRule(rule: UrlRule, config: RuleMatchingConfig): ProcessedUrlRule {
  const parsed = parseMatcher(rule.matcher, config);
  return {
    ...rule,
    ...parsed
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
  // Ensure requestUrl has a protocol for URL parsing
  const fullRequestUrl = requestUrl.startsWith('/')
    ? `http://example.com${requestUrl}`
    : (requestUrl.startsWith('http') ? requestUrl : `http://${requestUrl}`);
  const reqUrl = new URL(fullRequestUrl);

  const reqPath = normalizePath(reqUrl.pathname, config);
  const reqQuery = normalizeQuery(reqUrl.search, config);
  const reqHostname = reqUrl.hostname.toLowerCase();

  let best: {
    rule: UrlRule;
    score: number;
    staticSegments: number;
    queryPairs: number;
    wildcards: number;
    start: number;
    ruleQuery: Map<string, string[]>;
    hasPartialSegmentMatch: boolean;
  } | null = null;

  for (const rule of rules) {
    let rulePath: string[];
    let ruleQuery: Map<string, string[]>;
    let isDomainMatcher = false;
    let ruleHostname: string | undefined;

    if (isProcessedRule(rule)) {
      rulePath = rule.normalizedPath;
      ruleQuery = rule.normalizedQuery;
      isDomainMatcher = rule.isDomainMatcher;
      ruleHostname = rule.hostname;
    } else {
        // Just-in-time processing
        const parsed = parseMatcher(rule.matcher, config);
        rulePath = parsed.normalizedPath;
        ruleQuery = parsed.normalizedQuery;
        isDomainMatcher = parsed.isDomainMatcher;
        ruleHostname = parsed.hostname;
    }

    let domainMatchScore = 0;

    // Check Domain Match if applicable
    if (isDomainMatcher) {
        if (!ruleHostname || reqHostname !== ruleHostname) {
            continue;
        }
        domainMatchScore = 50;
    }

    // Standard Path Matching (Unified)
    // Pre-check length to avoid unnecessary query processing
    if (rulePath.length > reqPath.length) continue;

    for (let start = 0; start <= reqPath.length - rulePath.length; start++) {
      // Path matching
      let staticMatches = 0;
      let wildcards = 0;
      let pathMismatch = false;
      let hasPartialSegmentMatch = false;

      for (let i = 0; i < rulePath.length; i++) {
        const seg = rulePath[i];
        const reqSeg = reqPath[start + i];

        if (seg === "*" || seg.startsWith(":")) {
          wildcards++;
          continue;
        }

        // Check for explicit wildcard suffix (e.g., "prefix*")
        if (seg.endsWith("*") && seg.length > 1) {
          const prefix = seg.slice(0, -1);
          if (reqSeg && reqSeg.startsWith(prefix)) {
            staticMatches++;
            hasPartialSegmentMatch = true;
            continue;
          }
        }

        if (seg === reqSeg) {
          staticMatches++;
        } else if ((rule.redirectType === 'partial' || rule.redirectType === 'domain') && reqSeg && reqSeg.startsWith(seg)) {
          // Implicit partial match for 'partial' and 'domain' type rules
          staticMatches++;
          hasPartialSegmentMatch = true;
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
        !hasPartialSegmentMatch &&
        ruleQuery.size === reqQuery.size
      ) {
        exact = true;
      }

      const score =
        domainMatchScore +
        staticMatches * config.WEIGHT_PATH_SEGMENT +
        queryPairs * config.WEIGHT_QUERY_PAIR +
        wildcards * config.PENALTY_WILDCARD +
        (exact ? config.BONUS_EXACT_MATCH : 0);

      if (config.DEBUG) {
        console.debug(
          `Rule ${rule.matcher} -> score=${score}, domain=${domainMatchScore}, static=${staticMatches}, query=${queryPairs}, wildcards=${wildcards}, exact=${exact}, partialSeg=${hasPartialSegmentMatch}`,
        );
      }

      if (
        !best ||
        score > best.score ||
        (score === best.score && staticMatches > best.staticSegments) ||
        (score === best.score &&
          staticMatches === best.staticSegments &&
          queryPairs > best.queryPairs) ||
        (score === best.score &&
          staticMatches === best.staticSegments &&
          queryPairs === best.queryPairs &&
          wildcards < best.wildcards) ||
        (score === best.score &&
          staticMatches === best.staticSegments &&
          queryPairs === best.queryPairs &&
          wildcards === best.wildcards &&
          !exact &&
          rule.matcher.length > best.rule.matcher.length) ||
        (score === best.score &&
          staticMatches === best.staticSegments &&
          queryPairs === best.queryPairs &&
          wildcards === best.wildcards &&
          rule.matcher.length === best.rule.matcher.length &&
          (rule.createdAt || "") < (best.rule.createdAt || "")) ||
        (score === best.score &&
          staticMatches === best.staticSegments &&
          queryPairs === best.queryPairs &&
          wildcards === best.wildcards &&
          rule.matcher.length === best.rule.matcher.length &&
          (rule.createdAt || "") === (best.rule.createdAt || "") &&
          rule.id < best.rule.id)
      ) {
        best = {
          rule,
          score,
          staticSegments: staticMatches,
          queryPairs,
          wildcards,
          start,
          ruleQuery,
          hasPartialSegmentMatch
        };
      }
    }
  }

  if (!best) return null;

  // Calculate Match Quality
  let quality = 100;
  const start = best.start;
  const ruleQuery = best.ruleQuery;
  const hasPartialSegmentMatch = best.hasPartialSegmentMatch;

  // Check for extra query params
  let hasExtraQuery = false;
  for (const key of reqQuery.keys()) {
    if (!ruleQuery.has(key)) {
      hasExtraQuery = true;
      break;
    }
  }

  const isDomainRule = !best.rule.matcher.startsWith('/');

  if (isDomainRule) {
      // For domain rules, quality is high if it matched
      if (hasExtraQuery) {
          quality = 90;
      } else {
          quality = 100;
      }
  } else {
      const rulePathLength = best.staticSegments + best.wildcards;
      if (start > 0 || rulePathLength < reqPath.length || hasPartialSegmentMatch) {
        quality = 50;
      } else if (hasExtraQuery) {
        quality = 75;
      }
  }

  let level: 'red' | 'yellow' | 'green' = 'green';
  if (quality < 60) level = 'red';
  if (quality >= 60 && quality < 90) level = 'yellow';
  if (quality >= 90) level = 'green';

  return {
    rule: best.rule,
    score: best.score,
    quality,
    level,
    debug: {
        start,
        hasExtraQuery,
        isExact: start === 0 && !hasExtraQuery && (!isDomainRule ? best.staticSegments === reqPath.length : true)
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

export function findAllMatchingRules(
  requestUrl: string,
  rules: UrlRule[] | ProcessedUrlRule[],
  config: RuleMatchingConfig = RULE_MATCHING_CONFIG,
): MatchDetails[] {
  const reqUrl = new URL(requestUrl, "http://example.com");
  const reqPath = normalizePath(reqUrl.pathname, config);
  const reqQuery = normalizeQuery(reqUrl.search, config);
  const reqHostname = reqUrl.hostname.toLowerCase();

  const matches: MatchDetails[] = [];

  for (const rule of rules) {
    let rulePath: string[];
    let ruleQuery: Map<string, string[]>;
    let isDomainMatcher = false;
    let ruleHostname: string | undefined;

    if (isProcessedRule(rule)) {
      rulePath = rule.normalizedPath;
      ruleQuery = rule.normalizedQuery;
      isDomainMatcher = rule.isDomainMatcher;
      ruleHostname = rule.hostname;
    } else {
        const parsed = parseMatcher(rule.matcher, config);
        rulePath = parsed.normalizedPath;
        ruleQuery = parsed.normalizedQuery;
        isDomainMatcher = parsed.isDomainMatcher;
        ruleHostname = parsed.hostname;
    }

    let domainMatchScore = 0;
    if (isDomainMatcher) {
        if (!ruleHostname || reqHostname !== ruleHostname) {
            continue;
        }
        domainMatchScore = 50;
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
        if (seg === reqSeg) {
          staticMatches++;
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
        domainMatchScore +
        staticMatches * config.WEIGHT_PATH_SEGMENT +
        queryPairs * config.WEIGHT_QUERY_PAIR +
        wildcards * config.PENALTY_WILDCARD +
        (exact ? config.BONUS_EXACT_MATCH : 0);

      // Calculate Match Quality for this match
      let quality = 100;

      // Check for extra query params
      let hasExtraQuery = false;
      for (const key of reqQuery.keys()) {
        if (!ruleQuery.has(key)) {
          hasExtraQuery = true;
          break;
        }
      }

      const rulePathLength = staticMatches + wildcards;
      if (start > 0 || rulePathLength < reqPath.length) {
        quality = 50;
      } else if (hasExtraQuery) {
        quality = 75;
      }

      let level: 'red' | 'yellow' | 'green' = 'green';
      if (quality < 60) level = 'red';
      if (quality >= 60 && quality < 90) level = 'yellow';
      if (quality >= 90) level = 'green';

      matches.push({
        rule,
        score,
        quality,
        level,
        debug: {
          start,
          hasExtraQuery,
          isExact: start === 0 && !hasExtraQuery && staticMatches === reqPath.length
        }
      });

      // We found a match for this rule, no need to check other start positions for the same rule
      break;
    }
  }

  // Sort matches by score descending
  matches.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return 0; // Keep stability
  });

  return matches;
}
