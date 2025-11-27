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

export function selectMostSpecificRule(
  requestUrl: string,
  rules: UrlRule[] | ProcessedUrlRule[],
  config: RuleMatchingConfig = RULE_MATCHING_CONFIG,
): UrlRule | null {
  const reqUrl = new URL(requestUrl, "http://example.com");
  const reqPath = normalizePath(reqUrl.pathname, config);
  const reqQuery = normalizeQuery(reqUrl.search, config);

  let best: {
    rule: UrlRule;
    score: number;
    staticSegments: number;
    queryPairs: number;
    wildcards: number;
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
          (rule.createdAt || "") < (best.rule.createdAt || "")) ||
        (score === best.score &&
          staticMatches === best.staticSegments &&
          queryPairs === best.queryPairs &&
          wildcards === best.wildcards &&
          (rule.createdAt || "") === (best.rule.createdAt || "") &&
          rule.id < best.rule.id)
      ) {
        best = {
          rule,
          score,
          staticSegments: staticMatches,
          queryPairs,
          wildcards,
        };
      }
    }
  }

  return best ? best.rule : null;
}
