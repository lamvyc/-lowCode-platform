#!/usr/bin/env node
/**
 * 用 CDP 驱动无头 Chrome 打开页面：收集控制台错误 / 报错、等待选择器、求值、截图。
 *
 * 为什么需要它：happy-dom 没有真实布局引擎，浮层定位、z-index、真实鼠标事件序列
 * 一律测不到；而本项目的 `docs/questionBug.md` 记录过多个"合成事件测不出、真实鼠标
 * 可稳定复现"的问题。这个脚本用于补齐那段验证。
 *
 * 只用 Node 内置能力：Node 22+ 自带全局 WebSocket，因此**不需要**装 puppeteer/playwright。
 *
 * 用法：
 *   node scripts/cdp-inspect.mjs --url http://localhost:5174/ --out /tmp/shot.png
 *   node scripts/cdp-inspect.mjs --url ... --wait ".lc-designer" --eval "document.title"
 *   node scripts/cdp-inspect.mjs --url ... --click ".lc-node" --out after-click.png
 *
 * 参数：
 *   --url <url>          要打开的地址（必填）
 *   --out <path>         截图输出路径（png）
 *   --wait <selector>    等待该选择器出现（默认 body）
 *   --eval <expr>        求值并打印结果；可重复
 *   --click <selector>   点击（真实鼠标事件，非合成 click()）
 *   --type <text>        向当前聚焦元素逐字符输入
 *   --blur               让当前聚焦元素失焦
 *   --width / --height   视口尺寸（默认 1440x900）
 *   --port <n>           Chrome 调试端口（默认 9222）
 *   --keep-open          结束后不关闭 Chrome
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME =
  process.env.CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

function parseArgs(argv) {
  const args = { wait: 'body', width: 1440, height: 900, port: 9222, evals: [], evalsAfter: [], clicks: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i]
    const next = () => argv[++i]
    switch (key) {
      case '--url': args.url = next(); break
      case '--out': args.out = next(); break
      case '--wait': args.wait = next(); break
      case '--eval': args.evals.push(next()); break
      case '--eval-after': args.evalsAfter.push(next()); break
      case '--click': args.clicks.push(next()); break
      case '--type': args.type = next(); break
      case '--blur': args.blur = true; break
      case '--width': args.width = Number(next()); break
      case '--height': args.height = Number(next()); break
      case '--port': args.port = Number(next()); break
      case '--steps': args.steps = JSON.parse(next()); break
      case '--keep-open': args.keepOpen = true; break
      default:
        throw new Error(`未知参数: ${key}`)
    }
  }
  if (!args.url) throw new Error('缺少 --url')
  return args
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 轮询 CDP 的 /json/version，直到 Chrome 就绪；同时兼容 IPv4 / IPv6 绑定 */
async function waitForChrome(port, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    for (const host of ['127.0.0.1', '[::1]']) {
      try {
        const res = await fetch(`http://${host}:${port}/json/version`)
        if (res.ok) return host
      } catch {
        // 继续重试
      }
    }
    await sleep(250)
  }
  throw new Error(`Chrome 调试端口 ${port} 在 ${timeoutMs}ms 内未就绪`)
}

async function firstPageTarget(host, port) {
  const res = await fetch(`http://${host}:${port}/json`)
  const targets = await res.json()
  const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
  if (!page) throw new Error('未找到可用的 page target')
  return page
}

function createClient(wsUrl) {
  const ws = new WebSocket(wsUrl)
  let nextId = 0
  const pending = new Map()
  const events = []
  const logs = []
  let closedReason = null

  /** 未决请求全部失败退出 —— 否则 ws 断开后 promise 永不 settle，进程会静默退出（exit 0） */
  function failPending(reason) {
    for (const [id, entry] of pending) {
      pending.delete(id)
      entry.reject(new Error(reason))
    }
  }

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id !== undefined) {
      const entry = pending.get(msg.id)
      if (entry) {
        pending.delete(msg.id)
        msg.error ? entry.reject(new Error(JSON.stringify(msg.error))) : entry.resolve(msg.result)
      }
      return
    }
    events.push(msg)
    if (msg.method === 'Runtime.consoleAPICalled') {
      const level = msg.params.type
      if (level === 'error' || level === 'warning') {
        logs.push({
          level,
          text: msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '),
        })
      }
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails
      logs.push({ level: 'exception', text: d.exception?.description ?? d.text })
    } else if (msg.method === 'Log.entryAdded') {
      const e = msg.params.entry
      if (e.level === 'error' || e.level === 'warning') logs.push({ level: e.level, text: e.text })
    }
  })

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve)
    ws.addEventListener('error', () => reject(new Error('WebSocket 连接失败')))
  })

  ws.addEventListener('close', () => {
    closedReason = 'WebSocket 被对端关闭（Chrome 退出或页面被销毁）'
    failPending(closedReason)
  })

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (closedReason) {
        reject(new Error(`${closedReason}；无法发送 ${method}`))
        return
      }
      const id = ++nextId
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })
  }

  return { ws, ready, send, logs, get closedReason() { return closedReason } }
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (result.exceptionDetails) {
    return { error: result.exceptionDetails.exception?.description ?? result.exceptionDetails.text }
  }
  return { value: result.result?.value }
}

/** 轮询直到选择器出现（在页面内用 MutationObserver + 超时） */
async function waitForSelector(client, selector, timeoutMs = 15000) {
  const expr = `new Promise((resolve) => {
    const found = document.querySelector(${JSON.stringify(selector)})
    if (found) return resolve(true)
    const timer = setTimeout(() => { observer.disconnect(); resolve(false) }, ${timeoutMs})
    const observer = new MutationObserver(() => {
      if (document.querySelector(${JSON.stringify(selector)})) {
        clearTimeout(timer); observer.disconnect(); resolve(true)
      }
    })
    observer.observe(document.documentElement, { childList: true, subtree: true })
  })`
  const { value } = await evaluate(client, expr)
  return value === true
}

/** 取元素中心坐标（真实鼠标事件需要屏幕坐标） */
async function centerOf(client, selector) {
  const { value, error } = await evaluate(
    client,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)})
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }
    })()`,
  )
  if (error) throw new Error(error)
  return value
}

/** 真实鼠标点击：move → press → release（不是 element.click()） */
async function realClick(client, selector) {
  const box = await centerOf(client, selector)
  if (!box) throw new Error(`点击失败，选择器未命中: ${selector}`)
  const base = { x: Math.round(box.x), y: Math.round(box.y), button: 'left', clickCount: 1 }
  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...base, button: 'none' })
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base })
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base })
  await sleep(120)
  return box
}

/**
 * 真实拖拽：press → 多次 mouseMoved（buttons:1）→ release。
 *
 * HTML5 拖拽（dragstart/dragover/drop）由浏览器的**原生拖拽手势**触发，
 * 不是 `element.click()` 那类合成事件能模拟的；必须用真实鼠标事件序列，
 * 且中途要有足够多的移动步数越过拖拽阈值。
 *
 * spec: { from: 选择器, to: 选择器 | {x,y}, steps?: number }
 */
async function realDrag(client, spec, options = {}) {
  const fromBox = await centerOf(client, spec.from)
  if (!fromBox) throw new Error(`拖拽源未命中: ${spec.from}`)
  // to 支持三种写法：选择器 / 字面量坐标 / 运行时求值（用于"按当前布局算落点"）
  let toBox
  if (spec.toExpr) {
    const { value, error } = await evaluate(client, spec.toExpr)
    if (error) throw new Error(`toExpr 求值失败: ${error}`)
    toBox = value
  } else {
    toBox = typeof spec.to === 'string' ? await centerOf(client, spec.to) : spec.to
  }
  if (!toBox) throw new Error(`拖拽目标未命中: ${JSON.stringify(spec.to ?? spec.toExpr)}`)

  const start = { x: Math.round(fromBox.x), y: Math.round(fromBox.y) }
  const end = { x: Math.round(toBox.x), y: Math.round(toBox.y) }
  const steps = spec.steps ?? 16

  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved', x: start.x, y: start.y, button: 'none', buttons: 0,
  })
  await client.send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x: start.x, y: start.y, button: 'left', buttons: 1, clickCount: 1,
  })
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps
    await client.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: Math.round(start.x + (end.x - start.x) * t),
      y: Math.round(start.y + (end.y - start.y) * t),
      button: 'left',
      buttons: 1,
    })
    await sleep(25)
  }
  await sleep(200)
  // ⚠️ 关键：原生拖拽的 dragover 是**节流**的，插值循环结束时最后一次 dragover
  // 可能还停在路径中间，导致落点断言读到过期状态。在终点再显式发一次 move 并多停一会。
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved', x: end.x, y: end.y, button: 'left', buttons: 1,
  })
  await sleep(400)
  if (options.hold) return { start, end }
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: end.x, y: end.y, button: 'left', buttons: 0, clickCount: 1,
  })
  await sleep(250)
  return { start, end }
}

/** 释放鼠标（配合 dragHold 使用） */
async function releaseMouse(client, point) {
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: point.x, y: point.y, button: 'left', buttons: 0, clickCount: 1,
  })
  await sleep(300)
}

async function typeText(client, text) {
  for (const ch of text) {
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch })
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', text: ch })
    await sleep(25)
  }
}

async function capture(client, path) {
  const shot = await client.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  })
  writeFileSync(path, Buffer.from(shot.data, 'base64'))
  console.log(`[screenshot] ${path}`)
}

function print(label, value, error) {
  const short = label.replace(/\s+/g, ' ').slice(0, 70)
  console.log(`[${label.length > 70 ? `${short}…` : short}]`)
  console.log(`  => ${error ? `ERROR: ${error}` : JSON.stringify(value)}`)
}

/**
 * 按顺序执行一个步骤序列。
 *
 * 为什么需要它：`--click/--type/--eval` 这类开关是"分阶段"的（所有点击 → 所有输入 → 所有断言），
 * 无法表达"点击 → 断言 → 再输入 → 再断言"这种真实交互顺序。
 * `--steps` 接受 JSON 数组，严格按给定顺序执行：
 *   [{"click":"#a"},{"assert":"document.activeElement.id"},{"type":"abc"},{"wait":300},{"screenshot":"/tmp/x.png"}]
 */
async function runSteps(client, steps, args) {
  let heldAt = null
  for (const [index, step] of steps.entries()) {
    const tag = `#${index + 1}`
    if (typeof step.wait === 'number') {
      await sleep(step.wait)
      console.log(`[${tag} wait] ${step.wait}ms`)
      continue
    }
    if (step.eval !== undefined) {
      const { value, error } = await evaluate(client, step.eval)
      print(`${tag} eval ${step.eval}`, value, error)
    }
    if (step.click !== undefined) {
      const box = await realClick(client, step.click)
      console.log(`[${tag} click] ${step.click} @ ${Math.round(box.x)},${Math.round(box.y)}`)
    }
    if (step.type !== undefined) {
      await typeText(client, step.type)
      console.log(`[${tag} type] ${step.type}`)
    }
    if (step.drag !== undefined) {
      const { start, end } = await realDrag(client, step.drag)
      console.log(`[${tag} drag] ${step.drag.from} (${start.x},${start.y}) → (${end.x},${end.y})`)
    }
    // 按住不放：用于在"拖拽进行中"断言落点/幽灵层/指示器状态
    if (step.dragHold !== undefined) {
      const { start, end } = await realDrag(client, step.dragHold, { hold: true })
      heldAt = end
      console.log(`[${tag} dragHold] ${step.dragHold.from} (${start.x},${start.y}) → (${end.x},${end.y})`)
    }
    if (step.release) {
      if (!heldAt) throw new Error('release 之前没有 dragHold')
      await releaseMouse(client, heldAt)
      console.log(`[${tag} release] (${heldAt.x},${heldAt.y})`)
      heldAt = null
    }
    if (step.blur) {
      await evaluate(client, 'document.activeElement && document.activeElement.blur()')
      await sleep(150)
      console.log(`[${tag} blur]`)
    }
    if (step.assert !== undefined) {
      const { value, error } = await evaluate(client, step.assert)
      print(`${tag} assert ${step.assert}`, value, error)
    }
    if (step.screenshot !== undefined) {
      await capture(client, step.screenshot)
    }
  }
  if (args.out) await capture(client, args.out)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const userDataDir = mkdtempSync(join(tmpdir(), 'cdp-profile-'))

  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${args.port}`,
      '--remote-allow-origins=*',
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--hide-scrollbars',
      // ⚠️ 受限环境（容器 / 文件沙箱）里 Chrome 自身沙箱起不来，会在 CDP 连接成功后
      // 立刻以 SIGTRAP 崩溃——表现为"脚本静默 exit 0"。这三个开关必须保留。
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-breakpad',
      '--disable-crashpad',
      `--window-size=${args.width},${args.height}`,
      args.url,
    ],
    { stdio: 'ignore' },
  )

  // Chrome 自身的启动失败/提前退出必须显式暴露，否则表现为"脚本静默 exit 0"
  let chromeExit = null
  chrome.on('error', (error) => {
    console.error(`[fatal] Chrome 启动失败: ${error.message}`)
  })
  chrome.on('exit', (code, signal) => {
    chromeExit = `code=${code} signal=${signal}`
  })

  let client
  try {
    const host = await waitForChrome(args.port)
    const target = await firstPageTarget(host, args.port)
    client = createClient(target.webSocketDebuggerUrl)
    await client.ready
    await client.send('Page.enable')
    await client.send('Runtime.enable')
    await client.send('Log.enable')
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: args.width,
      height: args.height,
      deviceScaleFactor: 1,
      mobile: false,
    })

    const seen = await waitForSelector(client, args.wait)
    if (!seen) console.error(`⚠️ 等待选择器超时: ${args.wait}`)
    await sleep(600) // 让首屏渲染与异步数据源稳定

    for (const expr of args.evals) {
      const { value, error } = await evaluate(client, expr)
      print(`eval ${expr}`, value, error)
    }

    if (args.steps) {
      await runSteps(client, args.steps, args)
      await reportConsole(client)
      return
    }

    for (const selector of args.clicks) {
      const box = await realClick(client, selector)
      console.log(`[click] ${selector} @ ${Math.round(box.x)},${Math.round(box.y)} (${Math.round(box.w)}x${Math.round(box.h)})`)
    }

    if (args.type) {
      await typeText(client, args.type)
      console.log(`[type] ${args.type}`)
    }

    if (args.blur) {
      await evaluate(client, `document.activeElement && document.activeElement.blur()`)
      await sleep(200)
      console.log('[blur] 已失焦')
    }

    // 交互之后的断言：用于"先点击/输入/失焦，再读取结果"的场景
    for (const expr of args.evalsAfter) {
      const { value, error } = await evaluate(client, expr)
      print(`eval-after ${expr}`, value, error)
    }

    if (args.out) await capture(client, args.out)
    await reportConsole(client)
  } finally {
    if (client?.closedReason) console.error(`[warn] ${client.closedReason}`)
    if (chromeExit) console.error(`[warn] Chrome 已退出: ${chromeExit}`)
    if (!args.keepOpen && client) client.ws.close()
    if (!args.keepOpen) chrome.kill('SIGTERM')
  }
}

/** 汇总页面控制台里的 error / warning */
async function reportConsole(client) {
  const errors = client.logs.filter((l) => l.level === 'error' || l.level === 'exception')
  const warnings = client.logs.filter((l) => l.level === 'warning')
  console.log(`\n[console] error/exception ${errors.length} 条，warning ${warnings.length} 条`)
  for (const l of [...errors, ...warnings].slice(0, 25)) {
    console.log(`  [${l.level}] ${String(l.text).split('\n')[0].slice(0, 300)}`)
  }
}

main().catch((error) => {
  console.error(`[fatal] ${error.message}`)
  process.exit(1)
})
