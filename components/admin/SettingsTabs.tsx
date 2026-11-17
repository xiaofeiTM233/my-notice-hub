// components/admin/SettingsTabs.tsx
'use client'
import { App, Button, Form, Input, InputNumber, Radio, Select, Skeleton, Tabs } from 'antd'
import { signOut } from 'next-auth/react'
import { useState } from 'react'
import { ErrorState } from '@/components/common/ErrorState'
import { PageHeader } from '@/components/common/PageHeader'
import { useApiQuery } from '@/hooks/useApiQuery'
import { apiFetch } from '@/lib/client/api'
import {
  MEDIA_TYPES,
  MEDIA_TYPE_LABEL,
  STORAGE_FIELD_LABEL,
  STORAGE_TYPE_FIELDS,
  type MediaType,
} from '@/lib/shared/constants'
import type { SettingDto, StorageTestResultDto } from '@/lib/shared/types'

interface PasswordValues {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

function isSecretField(key: string): boolean {
  return /Token|Pass|SecretKey/i.test(key)
}

export function SettingsTabs() {
  const { data, loading, error, refresh } = useApiQuery<SettingDto>('/api/admin/settings')

  if (loading && !data) {
    return (
      <div className="admin-page">
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="admin-page">
        <ErrorState message={error.message} onRetry={refresh} />
      </div>
    )
  }

  if (!data) return null

  return <SettingsContent data={data} refresh={refresh} />
}

function SettingsContent({ data, refresh }: { data: SettingDto; refresh: () => void }) {
  const { message } = App.useApp()
  const [usernameForm] = Form.useForm<{ username: string }>()
  const [passwordForm] = Form.useForm<PasswordValues>()

  const [type, setType] = useState<MediaType>(data.media.type)
  const [maxMB, setMaxMB] = useState(
    Math.round((data.media.maxUploadSize / 1024 / 1024) * 10) / 10,
  )
  const [formats, setFormats] = useState<string[]>(data.media.allowedFormats)
  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [cleared, setCleared] = useState<string[]>([])
  const [savingStorage, setSavingStorage] = useState(false)
  const [testing, setTesting] = useState(false)

  const saveUsername = async (values: { username: string }) => {
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: { admin: { username: values.username.trim() } },
      })
      message.success('用户名已更新')
      refresh()
    } catch (saveError) {
      message.error(saveError instanceof Error ? saveError.message : '保存失败')
    }
  }

  const savePassword = async (values: PasswordValues) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的新密码不一致')
      return
    }
    try {
      await apiFetch('/api/admin/settings/password', {
        method: 'POST',
        body: { currentPassword: values.currentPassword, newPassword: values.newPassword },
      })
      message.success('密码已更新，请重新登录')
      await signOut({ callbackUrl: '/admin/login' })
    } catch (saveError) {
      message.error(saveError instanceof Error ? saveError.message : '修改失败')
    }
  }

  const saveStorage = async () => {
    setSavingStorage(true)
    try {
      const payload: Record<string, string | null> = {}
      for (const key of STORAGE_TYPE_FIELDS[type]) {
        const value = credentials[key]
        if (value !== undefined && value !== '') payload[key] = value
        else if (cleared.includes(key)) payload[key] = null
      }

      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: {
          media: {
            type,
            maxUploadSize: Math.round(maxMB * 1024 * 1024),
            allowedFormats: formats,
            credentials: payload,
          },
        },
      })
      message.success('存储配置已保存')
      setCredentials({})
      setCleared([])
      refresh()
    } catch (saveError) {
      message.error(saveError instanceof Error ? saveError.message : '保存失败')
    } finally {
      setSavingStorage(false)
    }
  }

  const testStorage = async () => {
    setTesting(true)
    try {
      const result = await apiFetch<StorageTestResultDto>(
        '/api/admin/settings/storage/test',
        { method: 'POST', body: { type } },
      )
      message.success(`连接正常，写入并读回耗时 ${result.tookMs} ms`)
    } catch (testError) {
      message.error(testError instanceof Error ? testError.message : '连接失败')
    } finally {
      setTesting(false)
    }
  }

  const accountTab = (
    <div className="settings-grid">
      <div className="admin-panel">
        <div className="panel-title">管理员用户名</div>
        <Form<{ username: string }>
          form={usernameForm}
          layout="vertical"
          initialValues={{ username: data.admin.username }}
          onFinish={saveUsername}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input maxLength={40} />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            保存用户名
          </Button>
        </Form>
      </div>

      <div className="admin-panel">
        <div className="panel-title">修改密码</div>
        <p className="muted" style={{ marginTop: 0 }}>
          至少 10 位并包含字母与数字；修改后当前会话立即失效。
        </p>
        <Form<PasswordValues> form={passwordForm} layout="vertical" onFinish={savePassword}>
          <Form.Item
            name="currentPassword"
            label="当前密码"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[{ required: true, min: 10, message: '至少 10 位' }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            rules={[{ required: true, message: '请再次输入新密码' }]}
          >
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            更新密码
          </Button>
        </Form>
      </div>
    </div>
  )

  const storageTab = (
    <div className="settings-grid">
      <div className="admin-panel">
        <div className="panel-title">存储类型</div>
        <Radio.Group
          value={type}
          onChange={(event) => {
            setType(event.target.value as MediaType)
            setCredentials({})
            setCleared([])
          }}
        >
          <div className="check-list">
            {MEDIA_TYPES.map((item) => (
              <Radio key={item} value={item}>
                {MEDIA_TYPE_LABEL[item]}
              </Radio>
            ))}
          </div>
        </Radio.Group>

        <div className="panel-title" style={{ marginTop: 24 }}>
          上传限制
        </div>
        <div className="row">
          <InputNumber
            min={0.1}
            max={4}
            step={0.1}
            value={maxMB}
            onChange={(value) => setMaxMB(typeof value === 'number' ? value : 4)}
            addonAfter="MB"
          />
          <span className="muted">平台请求体上限约 4 MB，Base64 类型另有 512 KB 限制。</span>
        </div>

        <div className="panel-title" style={{ marginTop: 24 }}>
          允许的格式
        </div>
        <Select
          mode="tags"
          style={{ width: '100%' }}
          value={formats}
          onChange={setFormats}
          placeholder="例如 png、jpg、pdf"
        />

        <div className="row" style={{ marginTop: 24 }}>
          <Button type="primary" loading={savingStorage} onClick={saveStorage}>
            保存存储配置
          </Button>
          <Button loading={testing} onClick={testStorage}>
            测试连接
          </Button>
        </div>
      </div>

      <div className="admin-panel">
        <div className="panel-title">{MEDIA_TYPE_LABEL[type]} 凭证</div>
        {STORAGE_TYPE_FIELDS[type].length === 0 ? (
          <p className="muted" style={{ marginTop: 0 }}>
            该类型无需额外凭证。
          </p>
        ) : (
          STORAGE_TYPE_FIELDS[type].map((key) => {
            const state = data.media.credentials[key]
            const placeholder = state?.set ? `已保存 ${state.hint}` : '未配置'
            return (
              <Form.Item key={key} label={STORAGE_FIELD_LABEL[key]}>
                <div className="row">
                  {isSecretField(key) ? (
                    <Input.Password
                      style={{ flex: 1 }}
                      value={credentials[key] ?? ''}
                      placeholder={placeholder}
                      onChange={(event) =>
                        setCredentials((prev) => ({ ...prev, [key]: event.target.value }))
                      }
                    />
                  ) : (
                    <Input
                      style={{ flex: 1 }}
                      value={credentials[key] ?? ''}
                      placeholder={placeholder}
                      onChange={(event) =>
                        setCredentials((prev) => ({ ...prev, [key]: event.target.value }))
                      }
                    />
                  )}
                  {state?.set ? (
                    <Button
                      size="small"
                      type="text"
                      danger
                      onClick={() => {
                        setCredentials((prev) => ({ ...prev, [key]: '' }))
                        setCleared((prev) => Array.from(new Set([...prev, key])))
                      }}
                    >
                      清除
                    </Button>
                  ) : null}
                </div>
              </Form.Item>
            )
          })
        )}
        <p className="muted">密钥保存后只回显掩码，留空表示不修改。</p>
      </div>
    </div>
  )

  return (
    <div className="admin-page">
      <PageHeader title="设置" description="账号与媒体存储配置，均只对本站生效。" />
      <Tabs
        items={[
          { key: 'account', label: '账号', children: accountTab },
          { key: 'storage', label: '媒体存储', children: storageTab },
        ]}
      />
    </div>
  )
}
