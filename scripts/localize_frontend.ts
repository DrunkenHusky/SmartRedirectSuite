import { Project, SyntaxKind, Node, JsxText, JsxAttribute, StringLiteral, ObjectLiteralExpression, PropertyAssignment, SourceFile, FunctionDeclaration, ArrowFunction, JsxExpression } from 'ts-morph';

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const sourceFiles = project.getSourceFiles("client/src/**/*.tsx");

function createKey(str: string) {
  let safeStr = str.replace(/[^a-zA-Z0-9\s_]/g, '')
                 .replace(/\s+/g, '_')
                 .toLowerCase();
  if (safeStr.length > 30) {
    safeStr = safeStr.substring(0, 30);
  }
  if (!safeStr) return "key_" + Math.random().toString(36).substring(7);
  return safeStr;
}

function ensureImport(sourceFile: SourceFile) {
  let hasImport = false;
  for (const importDecl of sourceFile.getImportDeclarations()) {
    if (importDecl.getModuleSpecifierValue() === 'react-i18next') {
      const namedImports = importDecl.getNamedImports();
      if (namedImports.some(ni => ni.getName() === 'useTranslation')) {
        hasImport = true;
        break;
      } else {
        importDecl.addNamedImport('useTranslation');
        hasImport = true;
        break;
      }
    }
  }

  if (!hasImport) {
    sourceFile.addImportDeclaration({
      moduleSpecifier: 'react-i18next',
      namedImports: ['useTranslation']
    });
  }
}

function ensureHook(node: FunctionDeclaration | ArrowFunction) {
  const body = node.getBody();
  if (Node.isBlock(body)) {
    const text = body.getText();
    if (!text.includes('useTranslation()')) {
      body.insertStatements(0, 'const { t } = useTranslation();');
    }
  }
}

for (const sourceFile of sourceFiles) {
  if (sourceFile.getBaseName() === 'main.tsx' || sourceFile.getBaseName() === 'i18n.ts') continue;

  let modified = false;

  // Find call expressions like toast({ title: "...", description: "..." })
  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const callExpr of callExpressions) {
    const expr = callExpr.getExpression();
    if (expr.getText() === 'toast') {
      const args = callExpr.getArguments();
      if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
        const obj = args[0];
        const properties = obj.getProperties();
        for (const prop of properties) {
          if (Node.isPropertyAssignment(prop)) {
            const name = prop.getName();
            if (name === 'title' || name === 'description') {
              const init = prop.getInitializer();
              if (Node.isStringLiteral(init)) {
                const text = init.getLiteralValue();
                if (text && /[a-zA-ZäöüÄÖÜß]/.test(text)) {
                  const key = createKey(text);
                  init.replaceWithText(`t('${key}', \`${text.replace(/`/g, '\\`')}\`)`);
                  modified = true;
                }
              }
            }
          }
        }
      }
    }
  }

  // Process JsxText that don't already contain t(...)
  const jsxTexts = sourceFile.getDescendantsOfKind(SyntaxKind.JsxText);
  for (const jsxText of jsxTexts) {
    const text = jsxText.getLiteralText();
    const trimmed = text.trim();
    if (trimmed && /[a-zA-ZäöüÄÖÜß]/.test(trimmed) && !trimmed.includes('{t(')) {
      const key = createKey(trimmed);
      const beforeSpace = text.substring(0, text.indexOf(trimmed));
      const afterSpace = text.substring(text.indexOf(trimmed) + trimmed.length);

      const newText = `${beforeSpace}{t('${key}', \`${trimmed.replace(/`/g, '\\`')}\`)}${afterSpace}`;
      jsxText.replaceWithText(newText);
      modified = true;
    }
  }

  // Process attributes like placeholder, title, aria-label
  const attributes = sourceFile.getDescendantsOfKind(SyntaxKind.JsxAttribute);
  for (const attr of attributes) {
    const nameNode = attr.getNameNode();
    const name = nameNode.getText();
    if (['placeholder', 'title', 'aria-label', 'description', 'label'].includes(name)) {
      const init = attr.getInitializer();
      if (Node.isStringLiteral(init)) {
        const text = init.getLiteralValue();
        if (text && /[a-zA-ZäöüÄÖÜß]/.test(text) && !text.includes('t(')) {
          const key = createKey(text);
          init.replaceWithText(`{t('${key}', \`${text.replace(/`/g, '\\`')}\`)}`);
          modified = true;
        }
      }
    }
  }

  if (modified) {
    ensureImport(sourceFile);

    const functions = sourceFile.getFunctions();
    for (const func of functions) {
        if (func.getName() && /^[A-Z]/.test(func.getName()!)) {
            ensureHook(func);
        }
    }

    const varDecls = sourceFile.getVariableDeclarations();
    for (const vd of varDecls) {
        if (/^[A-Z]/.test(vd.getName())) {
            const init = vd.getInitializer();
            if (Node.isArrowFunction(init)) {
                ensureHook(init);
            }
        }
    }

    sourceFile.saveSync();
    console.log(`Updated ${sourceFile.getBaseName()}`);
  }
}

console.log("AST Transformation complete.");
