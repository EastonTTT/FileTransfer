import { Router } from "express";
import multer from "multer";

const router = Router();
const upload = multer({ dest: "temp/" });

router.post("/", upload.single("chunk"));
router.post("/merge");
