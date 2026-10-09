import { spawn } from "node:child_process";
import { loadStagingEnvironment } from "./staging-environment.mjs";

const command = process.argv[2] ?? "check";
if (!["check", "build", "dev", "start", "smoke"].includes(command)) throw new Error("Use check, build, dev, start or smoke (UI-only port 3102).");
const env = loadStagingEnvironment(process.cwd());
env.PREDICTIVE_CUSTOMER_PRICING_VERSION = "v2";
if (command === "smoke") {
  // Leave the existing staging server on 3100 alone. UI-only smoke on a separate
  // loopback port deliberately cannot initialize or verify provider payments.
  env.PAYSTACK_SECRET_KEY = "";
  env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY = "";
}
console.log(`Pricing V2: isolated ${env.STAGING_INFRASTRUCTURE} staging; Paystack TEST ${env.PAYSTACK_SECRET_KEY ? "configured" : "not configured"}. No production activation.`);
if (command !== "check") {
  env.NODE_ENV = command === "dev" ? "development" : "production";
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", command === "smoke" ? "start" : command, ...(command === "build" ? [] : ["--hostname", "127.0.0.1", "--port", command === "smoke" ? "3102" : "3100"])], { env, stdio: "inherit" });
  child.on("exit", code => { process.exitCode = code ?? 1; });
}
