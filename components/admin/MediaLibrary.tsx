// components/admin/MediaLibrary.tsx
'use client'
import {
  AppstoreOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  TableOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Drawer,
  Input,
  Pagination,
  Segmented,
  Select,
  Table,
  Tag,
  type TableColumnsType,
} from 'antd'
import { useState } from 'react'
import { MediaUploadModal } from '@/components/admin/MediaUploadModal'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { MediaImage } from '@/components/common/MediaImage'
import { PageHeader } from '@/components/common/PageHeader'
import { useApiQuery } from '@/hooks/useApiQuery'
import { apiFetch } from '@/lib/client/api'
import {
  MEDIA_TYPE_LABEL,
  MEDIA_TYPES,
  type MediaType,
  type MediaView,
} from '@/lib/shared/constants'
import { useUIStore } from '@/lib/client/stores/ui'
import { formatBytes } from '@/lib/shared/format'
import type { Paginated } from '@/lib/shared/contracts/common'
import type { MediaDto } from '@/lib/shared/types'

export function MediaLibrary() {
  const { message, modal } = App.useApp()
  const view = useUIStore((state) => state.mediaView)
  const setView = useUIStore((state) => state.setMediaView)
  const [type, setType] = useState<MediaType | ''>('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [preview, setPreview] = useState<MediaDto | null>(null)

  const { data, loading, error, refresh } = useApiQuery<Paginated<MediaDto>>('/api/admin/media', {
    q: keyword,
    type: type || undefined,
    page,
    pageSize: 24,
  })

  const copyLink = async (media: MediaDto) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/api/media/${media.id}`)
      message.success('链接已复制')
    } catch {
      message.warning('复制失败，请手动复制')
    }
  }

  const rename = (media: MediaDto) => {
    let nextName = media.name
    modal.confirm({
      title: '重命名媒体',
      content: (
        <Input
          defaultValue={media.name}
          placeholder="媒体名称"
          onChange={(event) => {
            nextName = event.target.value
          }}
        />
      ),
      okText: '保存',
      cancelText: '取消',
      onOk: async () => {
        const name = nextName.trim()
        if (!name) {
          message.warning('名称不能为空')
          return Promise.reject(new Error('empty'))
        }
        await apiFetch(`/api/admin/media/${media.id}`, { method: 'PATCH', body: { name } })
        message.success('已更新')
        refresh()
        return undefined
      },
    })
  }

  const remove = (media: MediaDto) => {
    modal.confirm({
      title: '删除媒体',
      content: '删除后引用该媒体的文章会出现空白图片，确定继续？',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await apiFetch(`/api/admin/media/${media.id}`, { method: 'DELETE' })
          message.success('已删除')
          refresh()
        } catch (deleteError) {
          const detail =
            deleteError instanceof Error ? deleteError.message : '删除失败'
          message.error(detail)
          throw deleteError
        }
      },
    })
  }

  const columns: TableColumnsType<MediaDto> = [
    {
      title: '预览',
      key: 'preview',
      width: 72,
      render: (_value, media) => (
        <button
          type="button"
          className="media-table-thumb"
          onClick={() => setPreview(media)}
          aria-label={`预览 ${media.name || media.format}`}
        >
          <MediaImage
            mediaId={media.id}
            alt={media.name || media.format}
            fill
            sizes="40px"
          />
        </button>
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      render: (_value, media) => (
        <div className="table-title">
          <span className="table-title-text">{media.name || '未命名'}</span>
          {media.author?.name ? (
            <span className="table-subtitle">{media.author.name}</span>
          ) : null}
        </div>
      ),
    },
    {
      title: '格式',
      dataIndex: 'format',
      width: 96,
      render: (value: string) => <Tag variant="filled">{value.toUpperCase()}</Tag>,
    },
    {
      title: '存储类型',
      dataIndex: 'type',
      width: 130,
      render: (value: MediaType) => MEDIA_TYPE_LABEL[value],
    },
    {
      title: '大小',
      dataIndex: 'size',
      width: 100,
      render: (value?: number) => (value ? formatBytes(value) : '—'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_value, media) => (
        <div className="row actions">
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => setPreview(media)}
            aria-label="预览"
          />
          <Button
            size="small"
            type="text"
            icon={<CopyOutlined />}
            onClick={() => copyLink(media)}
            aria-label="复制链接"
          />
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={() => rename(media)}
            aria-label="重命名"
          />
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => remove(media)}
            aria-label="删除"
          />
        </div>
      ),
    },
  ]

  const items = data?.items ?? []
  const uploadModal = (
    <MediaUploadModal
      open={uploadOpen}
      onCancel={() => setUploadOpen(false)}
      onUploaded={() => {
        // 新文件按创建时间倒序排在第一页，上传后回到第一页才能看到
        if (page === 1) refresh()
        else setPage(1)
      }}
    />
  )

  return (
    <div className="admin-page">
      <PageHeader
        title="媒体库"
        description="媒体只通过站内路由访问，原始存储地址不会暴露。"
        extra={
          <>
            <Segmented
              size="small"
              aria-label="切换媒体视图"
              value={view}
              onChange={(next) => setView(next as MediaView)}
              options={[
                { value: 'grid', label: '卡片', icon: <AppstoreOutlined /> },
                { value: 'table', label: '表格', icon: <TableOutlined /> },
              ]}
            />
            <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadOpen(true)}>
              上传媒体
            </Button>
          </>
        }
      />

      <div className="filter-bar">
        <Input.Search
          allowClear
          placeholder="按名称搜索"
          style={{ width: 220 }}
          onSearch={(value) => {
            setPage(1)
            setKeyword(value.trim())
          }}
        />
        <Select
          allowClear
          placeholder="存储类型"
          style={{ minWidth: 180 }}
          value={type || undefined}
          onChange={(value) => {
            setPage(1)
            setType((value as MediaType) ?? '')
          }}
          options={MEDIA_TYPES.map((item) => ({ value: item, label: MEDIA_TYPE_LABEL[item] }))}
        />
        <Button onClick={refresh}>刷新</Button>
        <span className="muted">共 {data?.total ?? 0} 个媒体</span>
      </div>

      {error ? <ErrorState message={error.message} onRetry={refresh} /> : null}

      {loading && items.length === 0 ? (
        <div className="muted">加载中…</div>
      ) : items.length === 0 ? (
        <EmptyState
          title="媒体库是空的"
          description="上传图片或附件后，可在编辑器里直接选用"
          action={
            <Button type="primary" onClick={() => setUploadOpen(true)}>
              上传媒体
            </Button>
          }
        />
      ) : view === 'grid' ? (
        <div className="media-grid">
          {items.map((media) => (
            <div key={media.id} className="media-card">
              <button
                type="button"
                className="media-thumb"
                onClick={() => setPreview(media)}
                aria-label={`预览 ${media.name || media.format}`}
              >
                <MediaImage mediaId={media.id} alt={media.name || media.format} fill sizes="180px" />
              </button>
              <div className="media-info">
                <span className="media-name">{media.name || '未命名'}</span>
                <span className="muted">
                  {media.format.toUpperCase()}
                  {media.size ? ` · ${formatBytes(media.size)}` : ''}
                </span>
              </div>
              <div className="media-actions">
                <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => copyLink(media)} aria-label="复制链接" />
                <Button size="small" type="text" icon={<EditOutlined />} onClick={() => rename(media)} aria-label="重命名" />
                <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => remove(media)} aria-label="删除" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="media-table">
          <Table<MediaDto>
            size="small"
            rowKey="id"
            columns={columns}
            dataSource={items}
            loading={loading}
            pagination={false}
            scroll={{ x: 760 }}
          />
        </div>
      )}

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

      {uploadModal}

      <Drawer
        open={preview !== null}
        onClose={() => setPreview(null)}
        size={420}
        title={preview?.name || '媒体详情'}
      >
        {preview ? (
          <div className="stack">
            <div className="drawer-preview">
              <MediaImage mediaId={preview.id} alt={preview.name || preview.format} fill sizes="380px" />
            </div>
            <dl className="drawer-facts">
              <div>
                <dt>格式</dt>
                <dd>{preview.format.toUpperCase()}</dd>
              </div>
              <div>
                <dt>存储类型</dt>
                <dd>{MEDIA_TYPE_LABEL[preview.type]}</dd>
              </div>
              {preview.size ? (
                <div>
                  <dt>大小</dt>
                  <dd>{formatBytes(preview.size)}</dd>
                </div>
              ) : null}
              <div>
                <dt>访问地址</dt>
                <dd className="mono">{`/api/media/${preview.id}`}</dd>
              </div>
            </dl>
            <div className="row">
              <Button type="primary" icon={<CopyOutlined />} onClick={() => copyLink(preview)}>
                复制链接
              </Button>
              <a href={`/api/media/${preview.id}?download=1`} target="_blank" rel="noreferrer">
                <Button icon={<DownloadOutlined />}>下载原文件</Button>
              </a>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}
