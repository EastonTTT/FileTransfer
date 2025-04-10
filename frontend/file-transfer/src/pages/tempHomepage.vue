<template>
    <h1>temp home page..</h1>
    <button @click="handleClick">turn to upload page.</button>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const handleClick = () => {
    router.push({ name: 'upload' })
}
</script>

<style lang="less"></style>