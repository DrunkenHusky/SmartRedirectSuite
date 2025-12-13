
// Helper functions for admin rule management

interface Rule {
  id: string;
}

/**
 * Filters selected rule IDs to ensure they only contain IDs present in the current page rules.
 * This prevents accidental deletion of rules not currently visible/loaded.
 */
export function filterSafeRuleIds(selectedRuleIds: string[], paginatedRules: Rule[]): string[] {
  const currentPageRuleIds = paginatedRules.map(rule => rule.id);
  const safeRuleIds = selectedRuleIds.filter(id => currentPageRuleIds.includes(id));
  return safeRuleIds;
}

/**
 * Validates that all ruleIds to be deleted are present in the current page rules.
 * Throws an error if any ID is missing or if the list is empty.
 * This serves as a safety check before performing bulk operations.
 */
export function validateMutationRuleIds(ruleIds: string[], paginatedRules: Rule[]): string[] {
  const validRuleIds = filterSafeRuleIds(ruleIds, paginatedRules);

  if (validRuleIds.length === 0) {
    throw new Error('No valid rules selected from current page for deletion');
  }

  if (validRuleIds.length !== ruleIds.length) {
    const invalidCount = ruleIds.length - validRuleIds.length;
    throw new Error(`${invalidCount} selected rules are not on the current page. Only ${validRuleIds.length} will be deleted.`);
  }

  return validRuleIds;
}
