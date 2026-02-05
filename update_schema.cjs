const fs = require('fs');
const path = require('path');

const filePath = path.join('shared', 'schema.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add new schemas
const newSchemas = `
/**
 * Global Rule Schemas
 */
export const globalSearchAndReplaceSchema = z.object({
  id: z.string().uuid(),
  search: z.string().min(1, "Search term required"),
  replace: z.string().optional().default(""),
  caseSensitive: z.boolean().default(false),
  order: z.number().int().default(0),
});

export const globalStaticQueryParamSchema = z.object({
  id: z.string().uuid(),
  key: z.string().min(1, "Key required"),
  value: z.string(),
  skipEncoding: z.boolean().default(false),
});

export const globalKeptQueryParamSchema = z.object({
  id: z.string().uuid(),
  keyPattern: z.string().min(1, "Pattern required"),
  valuePattern: z.string().optional(),
  targetKey: z.string().optional(),
  skipEncoding: z.boolean().default(false),
});
`;

// Insert new schemas before generalSettingsSchema
const insertionPoint = content.indexOf('export const generalSettingsSchema');
if (insertionPoint !== -1) {
  content = content.slice(0, insertionPoint) + newSchemas + '\n' + content.slice(insertionPoint);
} else {
  console.error('Could not find generalSettingsSchema');
  process.exit(1);
}

// 2. Update generalSettingsSchema
const generalSettingsUpdate = `
  // Global Redirect Rules
  globalSearchAndReplace: z.array(globalSearchAndReplaceSchema).optional().default([]),
  globalStaticQueryParams: z.array(globalStaticQueryParamSchema).optional().default([]),
  globalKeptQueryParams: z.array(globalKeptQueryParamSchema).optional().default([]),
`;

// Insert into generalSettingsSchema (e.g., before updatedAt)
const settingsInsertionPoint = content.indexOf('updatedAt: z.string().datetime("Invalid update timestamp"),');
if (settingsInsertionPoint !== -1) {
  content = content.slice(0, settingsInsertionPoint) + generalSettingsUpdate + content.slice(settingsInsertionPoint);
} else {
  console.error('Could not find insertion point in generalSettingsSchema');
  process.exit(1);
}

// 3. Update urlTrackingSchema
const trackingUpdate = `
  redirectStrategy: z.enum(['rule', 'smart-search', 'domain-fallback']).optional(),
  appliedGlobalRules: z.array(z.object({
    id: z.string().uuid(),
    type: z.enum(['search', 'static', 'kept']),
    description: z.string()
  })).optional().default([]),
`;

// Insert into urlTrackingSchema (e.g., before closing brace of z.object)
const trackingSchemaStart = content.indexOf('export const urlTrackingSchema = z.object({');
const trackingSchemaEnd = content.indexOf('});', trackingSchemaStart);

if (trackingSchemaEnd !== -1) {
    // Insert at the end of the object definition
    content = content.slice(0, trackingSchemaEnd) + trackingUpdate + content.slice(trackingSchemaEnd);
} else {
  console.error('Could not find urlTrackingSchema end');
  process.exit(1);
}

fs.writeFileSync(filePath, content);
console.log('Schema updated successfully');
