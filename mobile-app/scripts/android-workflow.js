const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const localAndroidHome = path.join(projectRoot, ".android-home");
const localUserHome = path.join(projectRoot, ".android-user-home");
const localDrive = path.parse(localUserHome).root.replace(/[\\\/]+$/, "");
const localHomePath = localUserHome.slice(localDrive.length) || "\\";
const apkPath = path.join(projectRoot, "togetherly-latest.apk");
const appId = "com.srujan0610.togetherly";
const adbExe = process.platform === "win32" ? "adb.exe" : "adb";

fs.mkdirSync(localAndroidHome, { recursive: true });
fs.mkdirSync(localUserHome, { recursive: true });

function run(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: "inherit",
      shell: false,
      env: {
        ...process.env,
        ANDROID_SDK_HOME: localUserHome,
        ANDROID_USER_HOME: localAndroidHome,
        HOME: localUserHome,
        HOMEDRIVE: localDrive,
        HOMEPATH: localHomePath,
        USERPROFILE: localUserHome,
        ...extraEnv,
      },
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function installApk() {
  if (!fs.existsSync(apkPath)) {
    throw new Error(
      `APK not found at ${apkPath}. Build or copy the latest development APK first.`
    );
  }

  await run(adbExe, ["install", "-r", apkPath]);
}

async function launchApp() {
  await run(adbExe, [
    "shell",
    "monkey",
    "-p",
    appId,
    "-c",
    "android.intent.category.LAUNCHER",
    "1",
  ]);
}

async function startMetro() {
  await run("npx", ["expo", "start", "--dev-client", "--clear"]);
}

async function main() {
  const action = process.argv[2];

  if (action === "install-apk") {
    await installApk();
    return;
  }

  if (action === "launch") {
    await launchApp();
    return;
  }

  if (action === "redeploy") {
    await installApk();
    await launchApp();
    return;
  }

  if (action === "start") {
    await startMetro();
    return;
  }

  throw new Error(
    "Usage: node scripts/android-workflow.js <install-apk|launch|redeploy|start>"
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
