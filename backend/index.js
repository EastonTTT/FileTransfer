// 依赖导入
const express = require('express')
const cor = require('cor')

const app = express()
const port = 3000

//挂载中间件
app.use(cor())
app.use(express.json())

//路由注册



app.listen(port,() => {
    console.log(`server running on port: ${port}...`)
})