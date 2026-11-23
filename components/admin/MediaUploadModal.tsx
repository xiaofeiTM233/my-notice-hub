// components/admin/MediaUploadModal.tsx
'use client'
import { InboxOutlined } from '@ant-design/icons'
import { App, Form, Input, Modal, Upload, type UploadFile, type UploadProps } from 'antd'
import { useState } from 'react'
import { useApiQuery } from '@/hooks/useApiQuery'
import { apiFetch } from '@/lib/client/api'
import {
  DEFAULT_ALLOWED_FORMATS,
  UPLOAD_MAX_BYTES,
} from '@/lib/shared/constants'
import { formatBytes } from '@/lib/shared/format'
import type { MediaDto, SettingDto } from '@/lib/shared/types'

interface MediaUploadValues {
  file?: UploadFile[]
  name?: string
  author?: string
}

interface MediaUploadModalProps {
  open: boolean
  onCancel: () => void
  onUploaded: (media: MediaDto) => void
}

export function MediaUploadModal({ open, onCancel, onUploaded }: MediaUploadModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<MediaUploadValues>()
  const [submitting, setSubmitting] = useState(false)
  const { data: settings } = useApiQuery<SettingDto>(open ? '/api/admin/settings' : null)

  const allowedFormats = settings?.media.allowedFormats ?? DEFAULT_ALLOWED_FORMATS
  const maxUploadSize = Math.min(settings?.media.maxUploadSize ?? UPLOAD_MAX_BYTES, UPLOAD_MAX_BYTES)
  const accept = allowedFormats.map((format) => `.${format}`).join(',')
  const formatsHint = allowedFormats.slice(0, 6).join('、')
  const formatsMore = allowedFormats.length > 6 ? ' 等' : ''

  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    if (file.size > maxUploadSize) {
      message.error(`文件超过上限 ${formatBytes(maxUploadSize)}`)
      return Upload.LIST_IGNORE
    }
    if (!form.getFieldValue('name')) {
      form.setFieldsValue({ name: file.name })
    }
    return false
  }

  const close = () => {
    if (submitting) return
    form.resetFields()
    onCancel()
  }

  const submit = async () => {
    const values = await form.validateFields().catch(() => null)
    const file = values?.file?.[0]?.originFileObj
    if (!values || !file) return

    const body = new FormData()
    body.append('file', file)
    if (values.name?.trim()) body.append('name', values.name.trim())
    if (values.author?.trim()) body.append('author', values.author.trim())

    setSubmitting(true)
    try {
      const media = await apiFetch<MediaDto & { deduped?: boolean }>('/api/admin/media', {
        method: 'POST',
        body,
      })
      message.success(media.deduped ? '已存在相同文件，复用已有媒体' : '上传成功')
      form.resetFields()
      onUploaded(media)
      onCancel()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '上传失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      title="上传媒体"
      width={560}
      okText="上传"
      cancelText="取消"
      confirmLoading={submitting}
      closable={!submitting}
      mask={{ closable: !submitting }}
      cancelButtonProps={{ disabled: submitting }}
      afterClose={() => form.resetFields()}
      onCancel={close}
      onOk={submit}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="file"
          label="文件"
          valuePropName="fileList"
          getValueFromEvent={(event) => (Array.isArray(event) ? event : event?.fileList)}
          rules={[{ required: true, message: '请选择要上传的文件' }]}
        >
          <Upload.Dragger
            accept={accept}
            maxCount={1}
            disabled={submitting}
            beforeUpload={beforeUpload}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此处</p>
            <p className="ant-upload-hint">
              单文件不超过 {formatBytes(maxUploadSize)}；支持 {formatsHint}
              {formatsMore}
            </p>
          </Upload.Dragger>
        </Form.Item>

        <Form.Item
          name="name"
          label="名称"
          rules={[{ max: 120, message: '名称最多 120 字' }]}
        >
          <Input placeholder="留空则使用文件名" maxLength={120} />
        </Form.Item>

        <Form.Item
          name="author"
          label="作者"
          rules={[{ max: 60, message: '作者最多 60 字' }]}
        >
          <Input placeholder="可选" maxLength={60} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
