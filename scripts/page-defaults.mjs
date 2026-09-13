// Export the application's defaults for local data tools without browser auth.
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const source = fs.readFileSync(new URL("../firebase/postPageModel.ts", import.meta.url), "utf8");
const exports = {};
vm.runInNewContext(ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, {exports});
process.stdout.write(JSON.stringify(process.argv.includes("--post")
  ? exports.createDefaultPostPageContent("") : exports.createDefaultPageLayout()));
