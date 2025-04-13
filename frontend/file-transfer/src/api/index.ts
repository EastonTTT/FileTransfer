import myAxios from '@/utils/request'

export function uploadFile(data: FormData) {
  return myAxios.post('upload', data)
}

export function merge(data) {
  return myAxios.post('upload/merge', data)
}
