// scripts/smoke-api.ts
interface ApiResponse {
  status: number
  json: unknown
  text: string
  headers: Headers
}

const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000'
const USERNAME = process.env.SMOKE_ADMIN_USERNAME ?? 'admin'
const PASSWORD = process.env.SMOKE_ADMIN_PASSWORD ?? ''

const cookies = new Map<string, string>()
const results: { name: string; ok: boolean; detail: string }[] = []

function storeCookies(headers: Headers): void {
  const list = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : []
  for (const entry of list) {
    const pair = entry.split(';')[0]
    const index = pair.indexOf('=')
    if (index < 0) continue
    const name = pair.slice(0, index).trim()
    const value = pair.slice(index + 1).trim()
    if (value) cookies.set(name, value)
    else cookies.delete(name)
  }
}

async function request(path: string, init: RequestInit = {}): Promise<ApiResponse> {
  const headers = new Headers(init.headers)
  if (cookies.size > 0) {
    headers.set('cookie', Array.from(cookies, ([name, value]) => `${name}=${value}`).join('; '))
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers, redirect: 'manual' })
  storeCookies(response.headers)
  const text = await response.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { status: response.status, json, text, headers: response.headers }
}

function read<T>(payload: unknown, path: string[]): T | undefined {
  let current: unknown = payload
  for (const key of path) {
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current as T
}

function check(name: string, ok: boolean, detail = ''): void {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
}

async function login(): Promise<void> {
  const csrf = await request('/api/auth/csrf')
  const csrfToken = read<string>(csrf.json, ['csrfToken'])
  check('获取 CSRF token', Boolean(csrfToken), `HTTP ${csrf.status}`)
  if (!csrfToken) return

  const body = new URLSearchParams({
    csrfToken,
    username: USERNAME,
    password: PASSWORD,
    callbackUrl: `${BASE_URL}/admin/notices`,
    json: 'true',
  })

  await request('/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  const session = await request('/api/auth/session')
  check('管理员登录', Boolean(read<Record<string, unknown>>(session.json, ['user'])), `HTTP ${session.status}`)
}

async function main(): Promise<void> {
  if (!PASSWORD) {
    console.error('缺少 SMOKE_ADMIN_PASSWORD，无法执行登录相关用例')
    process.exitCode = 1
    return
  }

  const unauth = await request('/api/admin/notices')
  check('未登录访问管理接口返回 401', unauth.status === 401, `HTTP ${unauth.status}`)

  await login()

  const settings = await request('/api/admin/settings')
  check('读取设置', settings.status === 200, `HTTP ${settings.status}`)

  const adapters = await request('/api/admin/import/adapters')
  const adapterList = read<unknown[]>(adapters.json, ['data'])
  check('导入适配器接口', adapters.status === 200 && Array.isArray(adapterList), `HTTP ${adapters.status}`)

  const title = `冒烟测试 ${Date.now()}`
  const created = await request('/api/admin/notices', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      channel: '验证',
      priority: 'normal',
      title,
      summary: '冒烟测试摘要',
      body: '## 冒烟测试\n\n正文内容。',
      tags: ['smoke'],
    }),
  })
  const noticeId = read<string>(created.json, ['data', 'id'])
  check('新建文章', created.status === 200 && Boolean(noticeId), `HTTP ${created.status}`)

  if (noticeId) {
    const list = await request(`/api/notices?q=${encodeURIComponent('冒烟测试')}&pageSize=60`)
    const items = read<{ id: string }[]>(list.json, ['data', 'items']) ?? []
    check('公开列表可检索到新文章', items.some((item) => item.id === noticeId), `共 ${items.length} 条`)

    const detail = await request(`/api/notices/${noticeId}`)
    check('公开详情', detail.status === 200, `HTTP ${detail.status}`)

    const patched = await request(`/api/admin/notices/${noticeId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: `${title}（已修改）` }),
    })
    check('更新文章', patched.status === 200, `HTTP ${patched.status}`)

    const mediaForm = new FormData()
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/wD/6X8kAAAAAElFTkSuQmCC',
      'base64',
    )
    mediaForm.append('file', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'smoke.png')

    const uploaded = await request('/api/admin/media', { method: 'POST', body: mediaForm })
    const mediaId = read<string>(uploaded.json, ['data', 'id'])
    check('上传媒体', uploaded.status === 200 && Boolean(mediaId), `HTTP ${uploaded.status}`)

    if (mediaId) {
      const raw = await request(`/api/media/${mediaId}`)
      check(
        '媒体路由返回文件',
        raw.status === 200 && (raw.headers.get('content-type') ?? '').includes('image/png'),
        `HTTP ${raw.status}`,
      )
      const removed = await request(`/api/admin/media/${mediaId}`, { method: 'DELETE' })
      check('删除媒体', removed.status === 200, `HTTP ${removed.status}`)
    }

    const deleted = await request(`/api/admin/notices/${noticeId}`, { method: 'DELETE' })
    check('删除文章', deleted.status === 200, `HTTP ${deleted.status}`)
  }

  const failed = results.filter((item) => !item.ok)
  console.log(`\n共 ${results.length} 项，失败 ${failed.length} 项`)
  if (failed.length > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error('冒烟测试异常：', error)
  process.exitCode = 1
})
