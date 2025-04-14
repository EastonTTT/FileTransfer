import myAxios from '@/utils/request'

//文件传输
export function uploadFile(data: FormData) {
  return myAxios.post('upload', data)
}

//文件合并
export function merge(data: {
  fileHash: string
  fileName: string
  chunkSize: number
}) {
  return myAxios.post('upload/merge', data)
}

//检验文件是否存在
export function ifExist(data: string) {
  return myAxios.get('upload/ifExist', {
    params: data,
  })
}

//获取已经上传好的切片
export function getUploadedChunks(data: string) {
  return myAxios.get('upload/getUploadedChunks', {
    params: data,
  })
}
