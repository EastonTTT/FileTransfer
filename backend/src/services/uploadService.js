import fs from "fs-extra";
import path from "path";
import { pipeStream } from "../utils/stream";
import { getChunkDir, UPLOAD_DIR } from "../config/config";
import { handleFileName } from "../utils/file";

//切片存储函数
export const storeChunk = async (file, fileHash, chunkHash) => {
  const chunkDir = getChunkDir(fileHash); //获取构造好的切片目录
  await fs.ensureDir(chunkDir); //确保目录存在，如果不存在则新建一个目录
  const destPath = path.resolve(chunkDir, chunkHash); //设置切片最终的存储地址
  await fs.move(file.path, destPath, { overwrite: true }); //把切片从接收的暂存地址移动到规定的目的地址
};

//切片合并函数
export const mergeChunk = async (fileHash, fileName, chunkSize) => {
  const chunkDir = getChunkDir(fileHash); //获取切片存放的文件夹地址
  const ext = handleFileName(fileName); //获取文件的拓展名
  const finalDir = path.resolve(UPLOAD_DIR, `${fileName}${ext}`); //合成文件的最终存放地址
  const chunkFiles = await fs.readdir(chunkDir); //获取切片文件夹中的所有切片文件名
  chunkFiles.sort((a, b) => a.split("-")[1] - b.split("-")[1]); //对文件名排序，确保合成后的文件顺序正确

  await Promise.all(
    chunkFiles.map((chunk, index) => {
      const chunkPath = path.join(chunkDir, chunk); //合并得到切片的绝对路径
      const writeStream = fs.createWriteStream(finalDir, {
        //创建写入流，将切片写入到文件最终地址的指定位置
        start: index * chunkSize,
      });
      return pipeStream(chunkPath, writeStream); //传入切片绝对路径和写入流，在函数中异步写入
    })
  );

  await fs.remove(chunkDir); //等待写入完毕之后删除切片文件夹，释放磁盘空间
};

//获取已经上传好的切片文件名称数组，如果没有则返回空数组
export const getUploadedChunks = async (fileHash) => {
  const dir = getChunkDir(fileHash);
  return fs.existsSync(dir) ? await fs.readdir(dir) : [];
};

//在最终的文件保存地址查找文件是否存在
export const fileExist = (fileHash, ext) => {
  return fs.existsSync(path.join(UPLOAD_DIR, `${fileHash}${ext}`));
};
