import { Router } from "express";
import multer from "multer";
import {
  uploadChunk,
  mergeHandler,
  verifyUpload,
} from "../controllers/uploadController";

const router = Router();
const upload = multer({ dest: "temp/" });

router.post("/", upload.single("chunk"), uploadChunk);
router.post("/merge", mergeHandler);
router.post("/verify", verifyUpload);

export default router;
