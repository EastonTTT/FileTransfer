import fs from "fs-extra";
import path from "path";
import { pipeStream } from "../utils/stream";
import { getChunkDir, UPLOAD_DIR } from "../config/config";
import { handleFileName } from "../utils/file";

export const storeChunk = async (file, fileHash, chunkHash) => {
  const chunkDir = getChunkDir(fileHash);
  await fs.ensureDir(chunkDir);
  const destPath = path.resolve(chunkDir, chunkHash);
  await fs.move(file.path, destPath, { overwrite: true });
};

export const mergeChunk = async (fileHash, fileName, chunkSize) => {
  const chunkDir = getChunkDir(fileHash);
  const ext = handleFileName(fileName);
  const finalDir = path.resolve(UPLOAD_DIR, `${fileName}${ext}`);
  const chunkFiles = await fs.readdir(chunkDir);
  chunkFiles.sort((a, b) => a.split("-")[1] - b.split("-")[1]);
};
