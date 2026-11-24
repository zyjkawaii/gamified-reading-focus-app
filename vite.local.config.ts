import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import eyeTrackingAssets from './vite.eye-tracking'
// 本地运行用这个配置（使用 localhost:5173 并自动打开浏览器）。
// 浏览器要求在 HTTPS 或 localhost 等安全环境中使用摄像头。
export default defineConfig({plugins:[react(),tailwindcss(),eyeTrackingAssets()],server:{host:'localhost',port:5173,open:true}})
