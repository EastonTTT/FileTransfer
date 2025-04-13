import SparkMD5 from 'spark-md5'

//监听主线程传来的信息
self.addEventListener('message', async (event) => {
  try {
    const { file, chunkSize } = event.data //获取文件数据和切片大小
    const chunkList = createChunkList(file, chunkSize) //调用函数对文件进行切片 返回切片数组
    const fileHash = await calculateHash(chunkList) //调用函数计算文件的hash
    self.postMessage({ type: 'done', fileHash, chunkList }) //返回计算好的hash和切片数组给主线程
  } catch (err) {
    //错误处理
    self.postMessage({ type: 'error', error: err.message || err })
  }
})
//worker 内部错误处理
self.addEventListener('error', (event) => {
  self.postMessage({
    type: 'error',
    error: 'worker internal error' + event.message,
  })
  self.close()
})
//切片函数
const createChunkList = (file, chunkSize) => {
  let flag = 0
  const chunkList = []
  //file文件对象 作为blob对象的子类 可以调用其slice方法对数据进行分割
  while (flag < file.size) {
    chunkList.push({ chunkFile: file.slice(flag, flag + chunkSize) }) //把文件切成指定大小的切片
    flag += chunkSize
  }
  return chunkList
}

// 计算hash值
const calculateHash = async (fileChunkList) => {
  //引入工具
  const spark = new SparkMD5.ArrayBuffer()
  //文件不能直接被spark读取 需要把它转化为二进制数据
  for (let i = 0; i < fileChunkList.length; i++) {
    const buffer = await readFileAsArrayBuffer(fileChunkList[i].chunkFile)
    spark.append(buffer)
  }
  return spark.end()
}
//将blob转化为 ArrayBuffer
async function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = (e) => reject(e)

    reader.readAsArrayBuffer(file)
  })
}
