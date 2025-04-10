<template>
    <div class="upload">
        <input type="file" :multiple="multiple" accept="accept" :style="{ 'display': 'none' }" ref="filesInput"
            @change="filesChange">
        <button @click="handleClick">click me to upload files!</button>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { uploadFile, merge } from '@/api/index'
import { it, todo } from 'node:test'

const prop = defineProps({
    multiple: {
        type: Boolean,
        default: true,
    },
    accept: {
        type: String,
        default: '*',
    },
})

const uploadFileList = ref([]) //文件传输列表
const chunkSize = 1 * 1024 * 1024   //切片大小

const filesInput = ref(null)    //获取dom元素

const handleClick = () => {     //处理按钮点击，使用按钮点击出发文件的点击，因为input不显示，所以需要按钮来触发
    filesInput.value.click()
}

const filesChange = async () => {
    const input = filesInput.value
    if (!input || input.files.length === 0) {   //如果文件列表是空的 直接返回
        return
    }
    const files = Array.from(input.files)   //将文件列表转化为数组
    filesInput.value = ''   //将input输入框的值清空，这样就可以重复选中当前文件。不清空的话选择同样的文件是不会触发@change事件的

    try {
        //对每个单独的文件都执行操作
        await Promise.all(files.map((file, index) => (processSingleFile(file, index))))
    } catch (error) {
        console.log('error: 文件预处理失败.', error)
    }
}

const processSingleFile = async (file, index) => {

    if (file.size === 0) {
        return
    }
    const task = createUploadTask(file, index)
    uploadFileList.value.push(task)

    task.state = 1

    //将文件传入到webworker中计算文件的哈希值，并把文件切片，返回文件的哈希值和切片数组
    const { filehash, fileChunkList } = await useWorker(file)
    const baseName = getBaseName(file.name)
    const fullHash = `${file.name}${baseName}`

    task.fileHash = fullHash
    task.state = 2
    task.allChunkList = fileChunkList.map((chunk, index) => {
        buildChunk(chunk, index, fullHash, file, fileChunkList.length)
    })

    //单个文件的所有处理完成，进行上传
    uploadSingleFile(task)

}

const uploadSingleFile = (task) => {
    if (task.allChunkList.length === 0 || task.whileRequests.length > 0) return
    //计算出文件队列中还有多少待处理文件
    const activeTasksNum = uploadFileList.value.filter((item) => { item.state === 1 || item.state === 2 }).length

    let maxRequestNum = Math.ceil(6 / activeTasksNum)
    //取出allChunkList中的最后maxRequestNum个切片，并在allChunkList中删除他们
    const nextChunks = task.allChunkList.splice(-maxRequestNum)
    //把取出的切片放入到task的当前请求切片数组中
    task.whileRequests.push(...nextChunks)

    for (const chunk of nextChunks) {
        uploadChunk(chunk, task)
    }
}

const uploadChunk = async (chunkObj, task) => {
    const fd = new FormData()
    Object.entries({
        fileHash: chunkObj.fileHash,
        fileSize: chunkObj.fileSize,
        fileName: chunkObj.fileName,
        index: chunkObj.index,
        chunkFile: chunkObj.chunkFile,
        chunkHash: chunkObj.chunkHash,
        chunkSize: chunkObj.chunkSize,
        chunkNumber: chunkObj.chunkNumber,
        // @TODO : 这里的append要把val格式化为字符串，由于文件不能被格式化为字符串，所以需要单独处理
    }).forEach(([key, val]) => { fd.append(key, val) })

    const res: any = await uploadFile(fd)

    if (task.state === 5) return

    if (!res || res.code === -1) {
        task.errNumber++
        if (task.errNumber > 3) {
            task.state = 4
        } else {
            uploadChunk(chunkObj, task)
        }
    } else if (res.code === 0) {
        task.errNumber = Math.max(task.errNumber - 1, 0)
        task.finishNumber++
        chunkObj.finish = true
        // updateProgress()
        task.whileRequests.filter((item) => { item.chunkFile !== chunkObj.chunkFile })
        if (task.finishNumber === chunkObj.chunkNumber) handleMerge(task)
        else uploadSingleFile(task)
    }
}

const handleMerge = async (task) => {
    const res = await merge()


}

//生成一个记录文件处理状态的对象，便于跟踪处理进度
const createUploadTask = (file, index) => ({
    id: Date.now() + index,
    state: 0,//记录处理状态 0：未处理  1：计算哈希中  2：上传中  3：上传完成  4：上传失败  5：上传取消
    fileHash: '',//用于记录文件的哈希值
    fileName: file.name,//文件名
    fileSize: file.size,//文件大小
    allChunkList: [],//文件切片后的切片数组
    whileRequests: [],//正在请求的个数
    finishNumber: 0,//完成上传的个数
    errNumber: 0,//请求错误的次数
    percentage: 0,//上传进度
})

const useWorker = async (file) => {
    return new Promise((resolve) => {
        const worker = new Worker(new URL('@/worker/myWorker.ts', import.meta.url), { type: 'module' })
        worker.postMessage({ file, chunkSize })
        worker.onmessage = (e) => {
            const { fileHash, fileChunkList } = e.data
            resolve({ fileHash, fileChunkList })
        }
    })
}

const getBaseName = (name: string) => {
    const lastIndex: number = name.lastIndexOf('.')
    return lastIndex === -1 ? name : name.slice(0, lastIndex)

}

const buildChunk = (chunk, index, fileHash, file, length) => ({
    fileHash,
    fileSize: file.size,
    fileName: file.name,
    index,
    totalChunk: length,
    chunkHash: `${fileHash}-${index}`,
    chunkFile: chunk.chunkFile,
    chunkSize: chunkSize,
    finish: false
})


</script>

<style lang="less" scoped>
.upload {
    width: 200px;
    height: 200px;
    margin: 0 auto;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: skyblue;

    button {
        width: 200px;
        height: 30px;
    }
}
</style>