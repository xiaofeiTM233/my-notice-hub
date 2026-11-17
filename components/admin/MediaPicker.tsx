// components/admin/MediaPicker.tsx
'use client'
import { UploadOutlined } from '@ant-design/icons'
import { App, Button, Input, Modal, Pagination, Upload } from 'antd'
import { useState } from 'react'
import { MediaImage } from '@/components/common/MediaImage'
import { useApiQuery } from '@/hooks/useApiQuery'
import { apiFetch } from '@/lib/client/api'
import type { Paginated } from '@/lib/shared/contracts/common'
import type { MediaDto } from '@/lib/shared/types'

interface MediaPickerProps {
  open: boolean
  multiple?: boolean
  onCancel: () => void
  onConfirm: (media: MediaDto[]) => void
}

export function MediaPicker({ open, multiple, onCancel, onConfirm }: MediaPickerProps) {
  const { message } = App.useApp()
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [selected, setSelected] = useState<MediaDto[]>([])

  const { data, loading, refresh } = useApiQuery<Paginated<MediaDto>>(
    open ? '/api/admin/media' : null,
    { q: keyword, page, pageSize: 24 },
  )

  const toggle = (media: MediaDto) => {
    if (!multiple) {
      onConfirm([media])
      return
    }
    setSelected((prev) =>
      prev.some((item) => item.id === media.id)
        ? prev.filter((item) => item.id !== media.id)
        : [...prev, media],
    )
  }

  const upload = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    try {
      const media = await apiFetch<MediaDto>('/api/admin/media', { method: 'POST', body: form })
      message.success('上传成功')
      refresh()
      if (!multiple) onConfirm([media])
    } catch (error) {
      message.error(error instanceof Error ? error.message : '上传失败')
    }
    return false
  }

  return (
    <Modal
      open={open}
      title="选择媒体"
      width={880}
      onCancel={() => {
        setSelected([])
        onCancel()
      }}
      footer={
        multiple
          ? [
              <Button
                key="cancel"
                onClick={() => {
                  setSelected([])
                  onCancel()
                }}
              >
                取消
              </Button>,
              <Button
                key="ok"
                type="primary"
                disabled={selected.length === 0}
                onClick={() => {
                  onConfirm(selected)
                  setSelected([])
                }}
              >
                插入 {selected.length} 项
              </Button>,
            ]
          : null
      }
    >
      <div className="row" style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder="按名称搜索"
          style={{ width: 240 }}
          onSearch={(value) => {
            setPage(1)
            setKeyword(value.trim())
          }}
        />
        <Upload showUploadList={false} beforeUpload={upload}>
          <Button icon={<UploadOutlined />}>上传</Button>
        </Upload>
        {multiple ? <span className="muted">已选 {selected.length} 项</span> : null}
      </div>

      {data && data.items.length === 0 ? (
        <div className="muted" style={{ padding: '32px 0', textAlign: 'center' }}>
          还没有媒体，先上传一个。
        </div>
      ) : (
        <div className="media-grid">
          {(data?.items ?? []).map((media) => {
            const active = selected.some((item) => item.id === media.id)
            return (
              <button
                key={media.id}
                type="button"
                className={active ? 'media-card selected' : 'media-card'}
                onClick={() => toggle(media)}
              >
                <div className="media-thumb">
                  <MediaImage mediaId={media.id} alt={media.name || media.format} fill sizes="180px" />
                </div>
                <div className="media-info">
                  <span className="media-name">{media.name || '未命名'}</span>
                  <span>{media.format.toUpperCase()}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {loading ? <div className="muted" style={{ padding: 12 }}>加载中…</div> : null}

      {data && data.total > data.pageSize ? (
        <div className="pagination-wrap">
          <Pagination
            current={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onChange={(next) => setPage(next)}
          />
        </div>
      ) : null}
    </Modal>
  )
}
