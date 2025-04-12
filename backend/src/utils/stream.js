import fs from "fs-extra";

//用于将文件写入，写入完成后删除暂存的文件
export const pipeStream = (srcPath, writeStream) =>
  new Promise((resolve, reject) => {
    fs.createReadStream(srcPath)
      .on("error", reject)
      .pipe(writeStream)
      .on("finish", () => {
        fs.unlinkSync(srcPath);
        resolve();
      });
  });
