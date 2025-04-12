import path from "path";
import { fileURLToPath } from "url";

const DIR_NAME = path.dirname(fileURLToPath(import.meta.url));

export const UPLOAD_DIR = path.resolve(DIR_NAME, "../../target");

export const getChunkDir = (fileHash) =>
  path.resolve(UPLOAD_DIR, `Chunk_Cache${fileHash}`);
