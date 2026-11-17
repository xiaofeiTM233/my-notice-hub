// components/admin/ImportWizard.tsx
'use client'
import { InboxOutlined } from '@ant-design/icons'
import { Alert, App, Button, Input, Segmented, Select, Steps, Table, Upload } from 'antd'
import Link from 'next/link'
import { useState } from 'react'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { useApiQuery } from '@/hooks/useApiQuery'
import { apiFetch } from '@/lib/client/api'
import type {
  ImportAdapterInfo,
  ImportInvalidDto,
  ImportPreviewDto,
  ImportReportDto,
} from '@/lib/shared/types'

const INVALID_COLUMNS = [
  { title: '行号', dataIndex: 'index', width: 80, render: (value: number) => value + 1 },
  { title: '字段', dataIndex: 'path', width: 200 },
  { title: '问题', dataIndex: 'message' },
]

export function ImportWizard() {
  const { message } = App.useApp()
  const [step, setStep] = useState(0)
  const [adapterId, setAdapterId] = useState<string>()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreviewDto | null>(null)
  const [report, setReport] = useState<ImportReportDto | null>(null)
  const [channel, setChannel] = useState('')
  const [duplicate, setDuplicate] = useState<'skip' | 'overwrite'>('skip')
  const [busy, setBusy] = useState(false)

  const { data: adapters, loading } = useApiQuery<ImportAdapterInfo[]>(
    '/api/admin/import/adapters',
  )
  const selected = (adapters ?? []).find((item) => item.id === adapterId)

  const parse = async () => {
    if (!adapterId || (!selected?.remote && !file)) {
      message.warning(selected?.remote ? '请选择适配器' : '请选择适配器与文件')
      return
    }
    const form = new FormData()
    form.append('adapter', adapterId)
    if (file) form.append('file', file)

    setBusy(true)
    try {
      const result = await apiFetch<ImportPreviewDto>('/api/admin/import/parse', {
        method: 'POST',
        body: form,
      })
      setPreview(result)
      setStep(1)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '解析失败')
    } finally {
      setBusy(false)
    }
  }

  const commit = async () => {
    if (!preview) return
    setBusy(true)
    try {
      const result = await apiFetch<ImportReportDto>('/api/admin/import/commit', {
        method: 'POST',
        body: {
          jobId: preview.jobId,
          channel: channel.trim() || undefined,
          duplicate,
        },
      })
      setReport(result)
      setStep(2)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '导入失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-page">
      <PageHeader title="批量导入" description="从外部数据源解析并写入文章，流程分三步。" />

      <Steps
        current={step}
        items={[{ title: '选择数据源' }, { title: '校验预览' }, { title: '执行结果' }]}
      />

      {loading ? null : (adapters ?? []).length === 0 ? (
        <EmptyState
          title="尚未注册导入适配器"
          description="在 lib/server/import/ 下实现 ImportAdapter，并加入 registry.ts 的 importAdapters 数组，本页会自动列出。"
          action={
            <Link href="/admin/notices">
              <Button>返回文章列表</Button>
            </Link>
          }
        />
      ) : (
        <>
          {step === 0 ? (
            <div className="admin-panel stack">
              <Select
                placeholder="选择适配器"
                value={adapterId}
                onChange={setAdapterId}
                options={(adapters ?? []).map((item) => ({
                  value: item.id,
                  label: item.remote
                    ? item.label
                    : `${item.label}（${item.accepts.join(' / ')}）`,
                }))}
              />
              {selected?.remote ? (
                <Alert
                  type="info"
                  showIcon
                  title="实时拉取"
                  description={selected.description ?? '该适配器会直接请求来源接口，无需上传文件'}
                />
              ) : (
                <Upload.Dragger
                  maxCount={1}
                  beforeUpload={(next) => {
                    setFile(next as File)
                    return false
                  }}
                  onRemove={() => setFile(null)}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">选择要导入的文件</p>
                  <p className="ant-upload-hint">解析结果会先进入预览，不会直接写入数据库。</p>
                </Upload.Dragger>
              )}
              <div className="row">
                <Button type="primary" loading={busy} onClick={parse}>
                  解析并预览
                </Button>
              </div>
            </div>
          ) : null}

          {step === 1 && preview ? (
            <div className="stack">
              <div className="row">
                <span>共 {preview.total} 行</span>
                <span className="muted">有效 {preview.validCount}</span>
                <span className="muted">无效 {preview.invalidCount}</span>
              </div>

              {preview.invalidCount > 0 ? (
                <Table<ImportInvalidDto>
                  size="small"
                  rowKey={(record) => `${record.index}-${record.path}`}
                  columns={INVALID_COLUMNS}
                  dataSource={preview.invalid}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                />
              ) : (
                <Alert type="success" showIcon title="所有数据都通过了校验" />
              )}

              <div className="admin-panel stack">
                <div className="panel-title">导入选项</div>
                <Input
                  placeholder="统一覆盖频道（留空则使用数据里的频道）"
                  value={channel}
                  onChange={(event) => setChannel(event.target.value)}
                />
                <Segmented
                  value={duplicate}
                  onChange={(value) => setDuplicate(value as 'skip' | 'overwrite')}
                  options={[
                    { value: 'skip', label: '重复：跳过' },
                    { value: 'overwrite', label: '重复：覆盖' },
                  ]}
                />
                <div className="muted">
                  带来源标识的文章按来源去重，其余按同标题同时间判重。
                </div>
              </div>

              <details>
                <summary>查看前 {preview.sample.length} 条解析结果</summary>
                <pre className="json-preview mono">{JSON.stringify(preview.sample, null, 2)}</pre>
              </details>

              <div className="row">
                <Button onClick={() => setStep(0)}>上一步</Button>
                <Button
                  type="primary"
                  loading={busy}
                  disabled={preview.validCount === 0}
                  onClick={commit}
                >
                  确认导入 {preview.validCount} 条
                </Button>
              </div>
            </div>
          ) : null}

          {step === 2 && report ? (
            <div className="stack">
              <Alert
                type={report.failed > 0 ? 'warning' : 'success'}
                showIcon
                title="导入完成"
                description={`写入 ${report.inserted} 条，跳过 ${report.skipped} 条，失败 ${report.failed} 条。`}
              />
              <div className="row">
                <Link href="/admin/notices">
                  <Button type="primary">查看文章列表</Button>
                </Link>
                <Button
                  onClick={() => {
                    setStep(0)
                    setFile(null)
                    setPreview(null)
                    setReport(null)
                  }}
                >
                  再导入一批
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
