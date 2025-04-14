<template>
    <div class="upload">
        <input type="file" :multiple="multiple" accept="accept" :style="{ 'display': 'none' }" ref="filesInput"
            @change="filesChange">
        <button @click="handleClick">click me to upload files!</button>
    </div>
    <div v-for="(item, index) in uploadFileList" :key="index">
        <div>
            <t-progress theme="circle" :percentage="item.percentage" />
            <button @click="handlePause(item.id)">暂停上传</button>
            <button @click="handleResume(item.id)">恢复上传</button>
            <button @click="handleCancel(item.id)">取消上传</button>

        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { uploadFile, merge, ifExist, getUploadedChunks } from '@/api/index'
import type { Task, Chunk } from '@/models/index'

let startTime = 0
let endTime = 0

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

const uploadFileList = ref<Task[]>([]) //文件传输列表
const chunkSize = 1 * 1024 * 1024   //切片大小=1MB

const filesInput = ref()    //获取dom元素

const handleClick = () => {     //处理按钮点击，使用按钮点击出发文件的点击，因为input不显示，所以需要按钮来触发
    // if (filesInput.value) {
    //     console.log('input的对象丢失')
    //     return
    // }
    filesInput.value.click()
    console.log('文件传输按钮被点击。\n')
}

const filesChange = async () => {
    console.log('文件选择事件触发。\n')
    const input = filesInput.value
    if (!input || input.files.length === 0) {   //如果文件列表是空的 直接返回
        alert('来自filesChange事件处理：不能传输空文件！')
        return
    }
    const files = Array.from(input.files) as File[]  //将文件列表转化为数组
    console.log(files)
    input.value = ''   //将input输入框的值清空，这样就可以重复选中当前文件。不清空的话选择同样的文件是不会触发@change事件的

    try {
        //对每个单独的文件都执行操作
        await Promise.all(files.map((file, index) => (processSingleFile(file, index))))
    } catch (error) {
        console.log('error: 文件预处理失败.', error)
    }
}

const processSingleFile = async (file: File, index: number) => {
    startTime = performance.now()
    if (file.size === 0) {
        console.log('来自processSingleFIle：文件不能为空')
        return
    }
    const task: Task = reactive(createUploadTask(file, index))
    console.log('单个文件封装对象：', JSON.parse(JSON.stringify(task)))
    uploadFileList.value.push(task)
    task.state = 1

    //将文件传入到webworker中计算文件的哈希值，并把文件切片，返回文件的哈希值和切片数组
    try {
        const { fileHash, chunkList } = await useWorker(file) as { fileHash: string, chunkList: { chunkFile: File }[] }
        console.log('worker处理完成。文件哈希为：', fileHash)
        console.log('切片数组为：', chunkList)
        console.log('总切片数量为：', chunkList.length)

        const baseName = getBaseName(file.name)
        const fullHash = `${fileHash}_${baseName}`
        task.fileHash = fullHash
        task.totalChunk = chunkList.length

        //判断文件是否已存在，如果存在则“秒传”
        const isExist = await checkIfExist(fullHash)
        if (isExist) {
            task.state = 3
            task.percentage = 100
            console.log(`文件${file.name}已上传完毕`)
            return
        }

        task.state = 2
        task.allChunkList = chunkList.map((chunk, index) => {
            return buildChunk(chunk, index, fullHash, file, chunkList.length)
        })
        // console.log('task的allChunkList为：', JSON.parse(JSON.stringify(task.allChunkList)))

        //单个文件的所有处理完成，进行上传
        uploadSingleFile(task)
    } catch (error) {
        console.log('使用worker处理文件失败：', error)
    }

}

const uploadSingleFile = (task: Task) => {
    /*  如果出现以下情况则不进行上传：
        1.切片列表为空——没有可上传切片
        2.当前有正在上传的切片
        3.任务被取消或者暂停
    */
    if (task.allChunkList.length === 0 || task.whileRequests.length > 0 || task.cancel || task.pause) return
    //计算出文件队列中还有多少待处理文件
    const activeTasksNum = uploadFileList.value.filter((item) => { item.state === 1 || item.state === 2 }).length
    // console.log(uploadFileList)
    let maxRequestNum = Math.ceil(6 / activeTasksNum)
    //取出allChunkList中的最后maxRequestNum个切片，并在allChunkList中删除他们
    const nextChunks: Chunk[] = task.allChunkList.splice(-maxRequestNum)
    //把取出的切片放入到task的当前请求切片数组中
    task.whileRequests.push(...nextChunks)

    for (const chunk of nextChunks) {
        uploadChunk(chunk, task)
    }
}

const uploadChunk = async (chunkObj: Chunk, task: Task) => {
    if (task.state === 5) {
        console.log('请求已取消.')
        return
    }
    if (task.cancel || task.pause) return

    const fd = new FormData()
    // console.log('在函数uploadChunk中，chunk为：', chunkObj)
    Object.entries({
        fileHash: chunkObj.fileHash,
        fileSize: chunkObj.fileSize,
        fileName: chunkObj.fileName,
        index: chunkObj.index,
        // chunkFile: chunkObj.chunkFile,
        chunkHash: chunkObj.chunkHash,
        chunkSize: chunkObj.chunkSize,
        chunkNumber: chunkObj.totalChunk,
    }).forEach(([key, val]) => { fd.append(key, String(val)) })

    fd.append('chunkFile', chunkObj.chunkFile)
    try {
        const res: any = await uploadFile(fd)
        console.log('切片上传请求响应：', res)
        if (!res || res.data.code === -1) {
            task.errNumber++
            console.log('请求失败，总失败次数为：', task.errNumber)
            if (task.errNumber > 3) {
                task.state = 4
                console.log('上传失败..')
            } else {
                uploadChunk(chunkObj, task)
            }
        } else if (res.data.code === 0) {
            task.errNumber = Math.max(task.errNumber - 1, 0)
            task.finishNumber++
            console.log('上传成功，已上传：', task.finishNumber)
            chunkObj.finish = true
            updateProgress(task)
            task.whileRequests = task.whileRequests.filter((item) => item.chunkFile !== chunkObj.chunkFile)
            if (task.finishNumber === chunkObj.totalChunk) {
                console.log('所有切片上传完毕，准备进行合并...')
                await handleMerge(task)
                endTime = performance.now()
                console.log(`文件上传完毕✅ 总耗时 ${(endTime - startTime) / 1000} 秒`)
            }
            else uploadSingleFile(task)
        }
    } catch (error) {
        console.log('切片上传时发生错误', error)
    }

}

const useWorker = async (file: File) => {
    return new Promise((resolve) => {
        const worker = new Worker(new URL('@/worker/myWorker.js', import.meta.url), { type: 'module' })
        worker.postMessage({ file, chunkSize })
        worker.onmessage = (e) => {
            console.log('来自worker的消息：', e)
            const { fileHash, chunkList } = e.data
            resolve({ fileHash, chunkList })
        }
    })
}

const getBaseName = (name: string) => {
    const lastIndex: number = name.lastIndexOf('.')
    return lastIndex === -1 ? name : name.slice(0, lastIndex)

}

//生成一个记录文件处理状态的对象，便于跟踪处理进度
const createUploadTask = (file: File, index: number) => ({
    id: Date.now() + index,
    state: 0,//记录处理状态 0：未处理  1：计算哈希中  2：上传中  3：上传完成  4：上传失败  5：上传取消 6：暂停上传
    fileHash: '',//用于记录文件的哈希值
    fileName: file.name,//文件名
    fileSize: file.size,//文件大小
    allChunkList: [],//文件切片后的切片数组
    whileRequests: [],//正在请求的个数
    finishNumber: 0,//完成上传的个数
    errNumber: 0,//请求错误的次数
    percentage: 0,//上传进度
    pause: false,
    cancel: false,
    totalChunk: 0
})

const buildChunk = (chunk: { chunkFile: File }, index: number, fileHash: string, file: File, length: number): Chunk => ({
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

const handleMerge = async (task: Task) => {
    try {
        console.log('尝试合并切片...')
        const res = await merge({
            fileHash: task.fileHash,
            fileName: task.fileName,
            chunkSize,
        })
        console.log('切片合并请求响应：', res)

    } catch (error) {
        console.log('切片合并时出现错误', error)
    }
}

const handleUploadedChunks = async (fileHash: string) => {
    try {
        console.log('try getting uploaded chunks...')
        const res = await getUploadedChunks(fileHash)
        return res.data.uploadedChunks

    } catch (error) {
        console.log('getting uploaded chunks failed..', error)
    }
}

//暂停上传
const handlePause = (taskId: number) => {
    const task = uploadFileList.value.find((t) => (t.id === taskId))
    if (task) {
        task.pause = true
        task.state = 6
    }
}

//取消上传
const handleCancel = (taskId: number) => {
    const task = uploadFileList.value.find((t) => t.id === taskId)
    if (task) {
        task.cancel = true
        task.state = 5
        task.whileRequests = [] as Chunk[]
        task.allChunkList = [] as Chunk[]
        uploadFileList.value = uploadFileList.value.filter((t) => (t.id !== taskId))
    }
}

//恢复上传
const handleResume = (taskId: number) => {
    const task = uploadFileList.value.find((t) => (t.id === taskId))
    if (task) {
        task.state = 2
        uploadSingleFile(task)
        task.pause = false
    }
}

const checkIfExist = async (fileHash: string) => {
    try {
        const res = await ifExist(fileHash)
        return res.data.uploaded
    } catch (error) {
        console.log('获取文件存在状态失败')
        return false
    }
}

const updateProgress = (task: Task) => {
    task.percentage = Math.floor((task.finishNumber / task.totalChunk) * 100)
    console.log('current percentage:', task.percentage)
}


</script>

<style lang="less" scoped>
.upload {
    width: 200px;
    height: 200px;
    margin: 0 auto;
    display: flex;
    justify-content: center;
    align-items: center;
    // background-color: skyblue; 

    button {
        width: 200px;
        height: 30px;
    }
}
</style>