// pull contract deps

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const depsPath = path.join(__dirname, "../contracts/deps");
const gitUrl = "https://github.com/ProjectOpenSea/seaport.git";
const gitCommit = "1.1";

async function run() {
  if (!fs.existsSync(depsPath)) {
    console.log(`mkdir ${depsPath}..`);
    fs.mkdirSync(depsPath, { recursive: true });
  }

  // clean the folder first
  if (fs.existsSync(`${depsPath}/seaport`)) {
    console.log(`delete original ${depsPath}/seaport`);
    fs.rmSync(`${depsPath}/`, { recursive: true, force: true });
  }

  // pull seaport code
  // note: only with contracts, using sparse-checkout
  const pullCmdStr = `git clone --depth 1 --branch ${gitCommit} --filter=blob:none --sparse ${gitUrl} ${depsPath};`;
  const sparseCheckout = `cd ${depsPath} && git sparse-checkout set contracts`;
  execSync(pullCmdStr);
  execSync(sparseCheckout);
  // rename the folder
  execSync(`mv ${depsPath}/contracts ${depsPath}/seaport`);
}

run();
