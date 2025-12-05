
import { urlRuleSchemaWithValidation, validateTargetUrl } from '../../shared/validation';

async function runTest() {
  console.log('Testing domain redirect with subfolder using shared/validation.ts...');

  const ruleWithSubfolder = {
    matcher: '/some/path',
    targetUrl: 'https://example.com/subfolder',
    redirectType: 'domain' as const
  };

  try {
    const result = await urlRuleSchemaWithValidation.parseAsync(ruleWithSubfolder);
    console.log('Validation passed (UNEXPECTED):', result);
    process.exit(1);
  } catch (error: any) {
    console.log('Validation failed (EXPECTED):', error.message);
  }

  const ruleWithoutSubfolder = {
    matcher: '/some/path',
    targetUrl: 'https://example.com',
    redirectType: 'domain' as const
  };

  try {
    const result = await urlRuleSchemaWithValidation.parseAsync(ruleWithoutSubfolder);
    console.log('Validation passed (EXPECTED):', result);
  } catch (error: any) {
    console.log('Validation failed (UNEXPECTED):', error.message);
    process.exit(1);
  }

  const ruleWithSlash = {
    matcher: '/some/path',
    targetUrl: 'https://example.com/',
    redirectType: 'domain' as const
  };

  try {
    const result = await urlRuleSchemaWithValidation.parseAsync(ruleWithSlash);
    console.log('Validation passed (EXPECTED for slash):', result);
  } catch (error: any) {
    console.log('Validation failed (UNEXPECTED for slash):', error.message);
    process.exit(1);
  }

  // Test validateTargetUrl function
  if (validateTargetUrl('https://example.com/sub', 'domain')) {
    console.log('validateTargetUrl failed to reject subfolder (UNEXPECTED)');
    process.exit(1);
  } else {
    console.log('validateTargetUrl correctly rejected subfolder');
  }

  if (!validateTargetUrl('https://example.com', 'domain')) {
     console.log('validateTargetUrl failed to accept domain (UNEXPECTED)');
     process.exit(1);
  } else {
    console.log('validateTargetUrl correctly accepted domain');
  }
}

runTest();
