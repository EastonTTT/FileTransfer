export interface Task {
  id: number
  state: number
  fileHash: string
  fileSize: number
  fileName: string
  allChunkList: Chunk[]
  whileRequests: Chunk[]
  errNumber: number
  finishNumber: number
  percentage: number
  pause: boolean
  cancel: boolean
  totalChunk: number
}

export interface Chunk {
  fileHash: string
  fileSize: number
  fileName: string
  index: number
  totalChunk: number
  chunkHash: string
  chunkSize: number
  finish: boolean
  chunkFile: File
}
