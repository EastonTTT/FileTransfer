import {
  storeChunk,
  mergeChunk,
  getUploadedChunks,
  verifyUpload,
} from "../services/uploadService";
import { handleFileName } from "../utils/file";

export const uploadChunk = async (req, res) => {
  const { fileHash, chunkHash } = req.body;
  const file = req.body.file;

  if (!file || !fileHash || !chunkHash) {
    return res.status(400).json({ code: -1, message: "missing parameter" });
  }

  await storeChunk(file, fileHash, chunkHash);
  res.json({ code: 0, message: "upload chunk successfully!" });
};

export const mergeHandler = async (req, res) => {
  const { fileHash, fileName, chunkSize } = req.body;
  if (!fileHash || !fileName || !chunkSize) {
    return res.json({ code: -1, message: "missing parameter" });
  }

  await mergeChunk(fileHash, fileName, chunkSize);
  res.json({ code: 0, message: "chunk merged." });
};

export const verifyUpload = async (req, res) => {};
