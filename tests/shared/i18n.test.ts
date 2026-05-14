import assert from 'node:assert/strict';
import {
  DEFAULT_LANGUAGE,
  assertValidLanguageCode,
  createLanguageOptions,
  mergeTranslationDictionaries,
  sanitizeTranslationPayload,
} from '../../shared/i18n';

(() => {
  assert.equal(DEFAULT_LANGUAGE, 'en', 'English must remain the default language');

  assert.equal(assertValidLanguageCode('PT_br'), 'pt-br');
  assert.throws(
    () => assertValidLanguageCode('../en'),
    /Language code must use a BCP 47 style value/,
    'Path-like language codes must be rejected',
  );

  assert.deepEqual(
    sanitizeTranslationPayload({ ' title ': 'Welcome', empty: '', count: '5' }),
    { title: 'Welcome', empty: '', count: '5' },
    'Payload sanitization trims keys and preserves string values',
  );
  assert.throws(
    () => sanitizeTranslationPayload({ title: 42 }),
    /must be a string/,
    'Non-string values must be rejected before persistence',
  );

  assert.deepEqual(
    mergeTranslationDictionaries({ title: 'English title', body: 'English body' }, { title: 'Custom title' }),
    { title: 'Custom title', body: 'English body' },
    'Custom translations override English while retaining fallback keys',
  );

  const languageCodes = createLanguageOptions(['de', 'pt-br', 'en', '../en']);
  assert.equal(languageCodes[0].code, 'en', 'English should be first in language selectors');
  assert.ok(languageCodes.some((language) => language.code === 'pt-br' && !language.isBuiltIn));

  console.log('i18n helper tests passed');
})();
