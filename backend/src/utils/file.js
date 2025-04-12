//处理文件名，取出文件的拓展名
export const handleFileName = (fileName) => {
  const lastIndex = fileName.lastIndexOf(".");
  return lastIndex === -1 ? "" : fileName.slice(lastIndex);
};
