import myAxios from '@/utils/request'

export function uploadFile(data: FormData) {
  myAxios.post('', data)
}

export function merge() {
  myAxios.get('')
}
