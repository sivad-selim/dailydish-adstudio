// Export the application's own layout defaults for the one-time data conversion.
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const source = fs.readFileSync(new URL("../firebase/postPageModel.ts", import.meta.url), "utf8");
const exports = {};
vm.runInNewContext(ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, {exports});
process.stdout.write(JSON.stringify(exports.createDefaultPageLayout()));
