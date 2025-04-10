import axios from 'axios'

const BASE_URL: string = 'http://localhost:3000'

const myAxios = axios.create({
  baseURL: BASE_URL,
})

export default myAxios
