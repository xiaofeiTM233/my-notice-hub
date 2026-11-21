// components/admin/AutoImportSettings.tsx
'use client'
import { Alert, App, Button, InputNumber, Segmented, Select, Switch } from 'antd'
import { useState } from 'react'
import { useApiQuery } from '@/hooks/useApiQuery'
import { apiFetch } from '@/lib/client/api'
import { AUTO_IMPORT_MAX_LIMIT } from '@/lib/shared/constants'
import type {
  AutoImportSettingDto,
  ImportAdapterInfo,
  ImportRunReportDto,
} from '@/lib/shared/types'

interface AutoImportSettingsProps {
  autoImport: AutoImportSettingDto
  onSaved: () => void
}

export function AutoImportSettings({ autoImport, onSaved }: AutoImportSettingsProps) {
  const { message } = App.useApp()
  const [enabled, setEnabled] = useState(autoImport.enabled)
  const [adapters, setAdapters] = useState<string[]>(autoImport.adapters)
  const [limit, setLimit] = useState(autoImport.limit)
  const [duplicate, setDuplicate] = useState<'skip' | 'overwrite'>(autoImport.duplicate)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState<ImportRunReportDto | null>(null)

  const { data: adapterList } = useApiQuery<ImportAdapterInfo[]>('/api/admin/import/adapters')
  // 只有远程适配器能脱离上传文件被定时触发
  const options = (adapterList ?? [])
    .filter((adapter) => adapter.remote)
    .map((adapter) => ({ value: adapter.id, label: adapter.label }))

  const save = async () => {
    setSaving(true)
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: { autoImport: { enabled, adapters, limit, duplicate } },
      })
      message.success('自动导入配置已保存')
      onSaved()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const run = async () => {
    setRunning(true)
    try {
      const result = await apiFetch<ImportRunReportDto>('/api/admin/import/run', {
        method: 'POST',
      })
      setReport(result)
      const failed = result.adapters.some((item) => item.error)
      if (failed) message.warning('部分来源导入失败')
      else message.success('导入完成')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '导入失败')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="settings-grid">
      <div className="admin-panel">
        <div className="panel-title">定时导入</div>
        <div className="row" style={{ marginBottom: 16 }}>
          <Switch checked={enabled} onChange={setEnabled} />
          <span className="muted">
            开启后由 Vercel Cron 每天 01:00 UTC（北京时间 09:00）前后触发。
          </span>
        </div>

        <div className="panel-title">导入来源</div>
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          value={adapters}
          onChange={setAdapters}
          options={options}
          placeholder="选择一个或多个远程来源"
        />

        <div className="panel-title" style={{ marginTop: 24 }}>
          每次最多处理
        </div>
        <div className="row">
          <InputNumber
            min={1}
            max={AUTO_IMPORT_MAX_LIMIT}
            value={limit}
            onChange={(value) => setLimit(typeof value === 'number' ? value : 1)}
            suffix="条"
          />
          <span className="muted">未处理的部分留给后续运行，首次补齐历史请用导入脚本。</span>
        </div>

        <div className="panel-title" style={{ marginTop: 24 }}>
          重复数据
        </div>
        <Segmented
          value={duplicate}
          onChange={(value) => setDuplicate(value as 'skip' | 'overwrite')}
          options={[
            { label: '跳过已存在', value: 'skip' },
            { label: '覆盖已存在', value: 'overwrite' },
          ]}
        />

        <div className="row" style={{ marginTop: 24 }}>
          <Button type="primary" loading={saving} onClick={save}>
            保存自动导入配置
          </Button>
        </div>
      </div>

      <div className="admin-panel">
        <div className="panel-title">立即运行</div>
        <p className="muted" style={{ marginTop: 0 }}>
          使用已保存的配置手动执行一次，不受上方开关影响。
        </p>
        <Button loading={running} onClick={run}>
          立即运行
        </Button>

        {report?.adapters.length ? (
          <div className="stack" style={{ marginTop: 16 }}>
            {report.adapters.map((item) => (
              <Alert
                key={item.adapter}
                type={item.error ? 'error' : 'success'}
                showIcon
                title={item.label}
                description={
                  item.error
                    ? item.error
                    : `新增 ${item.inserted} 条，跳过 ${item.skipped} 条，失败 ${item.failed} 条`
                }
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
