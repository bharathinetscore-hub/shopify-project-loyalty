// const fs = require("fs");
// const path = require("path");

// const bundlePath = path.join(
//   __dirname,
//   "..",
//   "node_modules",
//   "next",
//   "dist",
//   "compiled",
//   "babel-packages",
//   "packages-bundle.js"
// );
// const pathParsePath = path.join(
//   __dirname,
//   "..",
//   "node_modules",
//   "path-parse",
//   "index.js"
// );

// function patchPathParseModule() {
//   if (!fs.existsSync(pathParsePath)) {
//     console.log("skip fix-next-invalid-path: path-parse module not found");
//     return;
//   }

//   let pathParseContent = fs.readFileSync(pathParsePath, "utf8");

//   if (!pathParseContent.includes("function sanitizePathString(pathString)")) {
//     pathParseContent = pathParseContent.replace(
//       "var win32 = {};\n\n",
//       `var win32 = {};\n\nfunction sanitizePathString(pathString) {\n  if (typeof pathString !== 'string') {\n    return pathString;\n  }\n\n  var queryIndex = pathString.search(/[?#]/);\n  if (queryIndex > 0 && pathString[0] === '/') {\n    return pathString.slice(0, queryIndex) || '/';\n  }\n\n  return pathString;\n}\n\n`
//     );
//   }

//   if (!pathParseContent.includes("pathString = sanitizePathString(pathString);")) {
//     pathParseContent = pathParseContent.replace(
//       "  var allParts = win32SplitPath(pathString);",
//       "  pathString = sanitizePathString(pathString);\n  var allParts = win32SplitPath(pathString);"
//     );
//     pathParseContent = pathParseContent.replace(
//       "  var allParts = posixSplitPath(pathString);",
//       "  pathString = sanitizePathString(pathString);\n  var allParts = posixSplitPath(pathString);"
//     );
//   }

//   fs.writeFileSync(pathParsePath, pathParseContent, "utf8");
// }

// if (!fs.existsSync(bundlePath)) {
//   console.log("skip fix-next-invalid-path: Next bundle not found");
//   patchPathParseModule();
//   process.exit(0);
// }

// let content = fs.readFileSync(bundlePath, "utf8");

// const helperSource =
//   'var __shopifyLogInvalidPath=function(e,t){try{var r=new Error("shopify-invalid-path-trace");console.error("[shopify-invalid-path]",t,e);console.error(r.stack)}catch(n){}};var __shopifySanitizePath=function(e){if(typeof e!=="string"){return e}var r=e.search(/[?#]/);if(r>0&&e[0]==="/"){__shopifyLogInvalidPath(e,"sanitize");return e.slice(0,r)||"/"}return e};';

// const anchor =
//   'var s={};function win32SplitPath(e){return t.exec(e).slice(1)}';

// if (!content.includes("__shopifyLogInvalidPath")) {
//   if (!content.includes(anchor)) {
//     console.error("fix-next-invalid-path: could not find path-parse anchor");
//     process.exit(1);
//   }

//   content = content.replace(anchor, `${helperSource}${anchor}`);
// }

// if (!content.includes("win32SplitPath(__shopifySanitizePath(e))")) {
//   content = content.replace("var r=win32SplitPath(e);", "var r=win32SplitPath(__shopifySanitizePath(e));");
// }

// if (!content.includes("posixSplitPath(__shopifySanitizePath(e))")) {
//   content = content.replace("var r=posixSplitPath(e);", "var r=posixSplitPath(__shopifySanitizePath(e));");
// }

// if (!content.includes('__shopifyLogInvalidPath(e,"throw")')) {
//   content = content.replace(
//     `throw new TypeError("Invalid path '"+e+"'")`,
//     `__shopifyLogInvalidPath(e,"throw");throw new TypeError("Invalid path '"+e+"'")`
//   );
// }

// fs.writeFileSync(bundlePath, content, "utf8");
// patchPathParseModule();
// console.log("fix-next-invalid-path: applied");
