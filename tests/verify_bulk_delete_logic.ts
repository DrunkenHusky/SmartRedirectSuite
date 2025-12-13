
import { suite } from 'uvu';
import * as assert from 'uvu/assert';
import { filterSafeRuleIds, validateMutationRuleIds } from '../client/src/lib/admin-utils';

// Test suite
const test = suite('Bulk Delete Logic Verification');

test('should filter out rules not on the current page', () => {
  const paginatedRules = [{ id: '1' }, { id: '2' }];
  const selectedRuleIds = ['1', '2', '3']; // '3' is not on the current page

  const safeRuleIds = filterSafeRuleIds(selectedRuleIds, paginatedRules);

  assert.equal(safeRuleIds, ['1', '2']);
  console.log('Test passed: filtered out rules not on current page');
});

test('should pass validation in mutation when rules are filtered', () => {
  const paginatedRules = [{ id: '1' }, { id: '2' }];
  // This is what the component does: filters first
  const selectedRuleIds = ['1', '2', '3'];
  const safeRuleIds = filterSafeRuleIds(selectedRuleIds, paginatedRules);

  // Then passes safeRuleIds to mutation
  try {
    const validIds = validateMutationRuleIds(safeRuleIds, paginatedRules);
    assert.equal(validIds, ['1', '2']);
    console.log('Test passed: mutation validation passed for filtered rules');
  } catch (e) {
    assert.unreachable(`Mutation validation failed unexpectedly: ${e}`);
  }
});

test('should fail validation in mutation if rules are NOT filtered', () => {
  const paginatedRules = [{ id: '1' }, { id: '2' }];
  const selectedRuleIds = ['1', '2', '3']; // Unfiltered

  try {
    validateMutationRuleIds(selectedRuleIds, paginatedRules);
    assert.unreachable('Mutation validation should have failed');
  } catch (e: any) {
    assert.match(e.message, /selected rules are not on the current page/);
    console.log('Test passed: mutation validation failed as expected for unfiltered rules');
  }
});

test.run();
