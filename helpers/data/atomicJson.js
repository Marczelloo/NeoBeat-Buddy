const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const path = require("node:path");

function temporaryPath(filePath) {
  return `${filePath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
}

function writeJsonAtomicSync(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = temporaryPath(filePath);
  try {
    fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), "utf8");
    fs.renameSync(tempPath, filePath);
  } finally {
    if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { force: true });
  }
}

async function writeJsonAtomic(filePath, value) {
  await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = temporaryPath(filePath);
  try {
    await fsPromises.writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");
    await fsPromises.rename(tempPath, filePath);
  } finally {
    await fsPromises.rm(tempPath, { force: true }).catch(() => {});
  }
}

function backupCorruptFileSync(filePath) {
  const backupPath = `${filePath}.corrupt-${Date.now()}`;
  fs.renameSync(filePath, backupPath);
  return backupPath;
}

async function backupCorruptFile(filePath) {
  const backupPath = `${filePath}.corrupt-${Date.now()}`;
  await fsPromises.rename(filePath, backupPath);
  return backupPath;
}

module.exports = { backupCorruptFile, backupCorruptFileSync, writeJsonAtomic, writeJsonAtomicSync };
