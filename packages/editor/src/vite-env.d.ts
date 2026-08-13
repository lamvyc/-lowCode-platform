/** Vite ?worker 导入的模块声明 */
declare module '*?worker' {
  const workerConstructor: new () => Worker
  export default workerConstructor
}
