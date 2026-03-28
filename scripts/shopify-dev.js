// const { spawn, execFileSync } = require("child_process");
console.log("🌐 Tunnel started at:", new Date().toISOString());
// const path = require("path");

// const { ensureShopifyCliHost } = require("./check-dev-host");

// ensureShopifyCliHost();

// const projectRoot = path.join(__dirname, "..");
// const forcedEnv = {
//   ...process.env,
//   CI: "1",
//   NODE_ENV: "development",
// };

// process.on("uncaughtException", (error) => {
//   console.error("shopify-dev: uncaughtException");
//   console.error(error && error.stack ? error.stack : error);
// });

// process.on("unhandledRejection", (error) => {
//   console.error("shopify-dev: unhandledRejection");
//   console.error(error && error.stack ? error.stack : error);
// });

// function run(command, args, env) {
//   return new Promise((resolve, reject) => {
//     console.error(`shopify-dev: spawning ${command} ${args.join(" ")}`);
//     const child = spawn(command, args, {
//       cwd: projectRoot,
//       env,
//       stdio: "inherit",
//       shell: false,
//     });

//     child.on("error", reject);
//     child.on("exit", (code, signal) => {
//       console.error(
//         `shopify-dev: child exited command=${command} code=${String(code)} signal=${String(signal)}`
//       );
//       if (signal) {
//         reject(new Error(`${command} ${args.join(" ")} exited with signal ${signal}`));
//         return;
//       }
//       if (code !== 0) {
//         reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
//         return;
//       }
//       resolve();
//     });
//   });
// }

// function applyInvalidPathPatch(env) {
//   return run(process.execPath, [path.join(projectRoot, "scripts", "fix-next-invalid-path.js")], env);
// }

// function ensurePortAvailable(port) {
//   if (process.platform !== "win32") {
//     return;
//   }

//   try {
//     const output = execFileSync("netstat", ["-ano"], {
//       cwd: projectRoot,
//       env: forcedEnv,
//       encoding: "utf8",
//       stdio: ["ignore", "pipe", "ignore"],
//     });
//     const lines = output
//       .split(/\r?\n/)
//       .filter((line) => line.includes(`:${port}`) && line.includes("LISTENING"));

//     if (lines.length === 0) {
//       return;
//     }

//     const pid = lines[0].trim().split(/\s+/).pop();
//     throw new Error(
//       `Port ${port} is already in use by PID ${pid}. Stop that process first, then rerun 'shopify app dev --reset'.`
//     );
//   } catch (error) {
//     if (error && /Port \d+ is already in use/.test(error.message)) {
//       throw error;
//     }
//   }
// }

// async function main() {
//   ensurePortAvailable(3000);
//   console.error("shopify-dev: applying invalid-path runtime patch");
//   await applyInvalidPathPatch(forcedEnv);
//   console.error("shopify-dev: starting custom server on port 3000");
//   await new Promise((resolve, reject) => {
//     const child = spawn(process.execPath, [path.join(projectRoot, "server.js")], {
//       cwd: projectRoot,
//       env: forcedEnv,
//       stdio: "inherit",
//       shell: false,
//     });

//     child.on("error", reject);
//     child.on("exit", (code, signal) => {
//       if (signal) {
//         reject(new Error(`server.js exited with signal ${signal}`));
//         return;
//       }
//       reject(new Error(`server.js exited with code ${code}`));
//     });
//   });
// }

// main().catch((error) => {
//   console.error(error.message);
//   process.exit(1);
// });
