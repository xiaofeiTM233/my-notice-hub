// app/api/mcp/route.ts
import { NextResponse } from 'next/server'
import { callTool, toolListPayload } from '@/lib/server/mcp/tools'

const PROTOCOL_VERSION = '2025-06-18'
const SERVER_INFO = { name: 'notice-hub', version: '1.0.0' }

interface JsonRpcRequest {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: Record<string, unknown>
}

type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: string | number | null; result: unknown }
  | { jsonrpc: '2.0'; id: string | number | null; error: { code: number; message: string } }
  | null

// 无状态实现：不分配 Mcp-Session-Id，也不提供服务端 SSE 推送。
async function dispatch(message: JsonRpcRequest, request: Request): Promise<JsonRpcResponse> {
  const id = message.id ?? null
  const isNotification = message.id === undefined

  if (message.method === 'initialize') {
    const requested = message.params?.protocolVersion
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: typeof requested === 'string' ? requested : PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      },
    }
  }
  if (message.method === 'notifications/initialized') return null
  if (message.method === 'ping') return { jsonrpc: '2.0', id, result: {} }
  if (message.method === 'tools/list') return { jsonrpc: '2.0', id, result: toolListPayload() }
  if (message.method === 'tools/call') {
    if (isNotification) return null
    const params = message.params ?? {}
    const name = String(params.name ?? '')
    const args = (params.arguments as Record<string, unknown>) ?? {}
    return { jsonrpc: '2.0', id, result: await callTool(name, args, request) }
  }
  if (isNotification) return null
  return { jsonrpc: '2.0', id, error: { code: -32601, message: `不支持的方法 ${message.method}` } }
}

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: '请求体不是合法 JSON' } },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } },
    )
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  }

  if (Array.isArray(payload)) {
    const results = await Promise.all(payload.map((item) => dispatch(item as JsonRpcRequest, request)))
    const filtered = results.filter(Boolean)
    if (!filtered.length) return new Response(null, { status: 202, headers })
    return new Response(JSON.stringify(filtered), { status: 200, headers })
  }

  const result = await dispatch(payload as JsonRpcRequest, request)
  // 只有通知时按规范回 202 且不带响应体。
  if (!result) return new Response(null, { status: 202, headers })
  return new Response(JSON.stringify(result), { status: 200, headers })
}

// 不提供服务端推送流：告知客户端只用 POST 即可。
export function GET() {
  return NextResponse.json(
    { error: { code: 'METHOD_NOT_ALLOWED', message: '本服务只支持 POST 的 JSON-RPC 请求' } },
    { status: 405, headers: { Allow: 'POST, OPTIONS', 'Access-Control-Allow-Origin': '*' } },
  )
}

export function DELETE() {
  return new Response(null, {
    status: 405,
    headers: { Allow: 'POST, OPTIONS', 'Access-Control-Allow-Origin': '*' },
  })
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
      'Access-Control-Max-Age': '86400',
    },
  })
}
