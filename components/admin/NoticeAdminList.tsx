// components/admin/NoticeAdminList.tsx
'use client'
import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  ImportOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { App, Button, Grid, Modal, Table, Tag, type TableColumnsType } from 'antd'
import Link from 'next/link'
import { useState } from 'react'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { MediaImage } from '@/components/common/MediaImage'
import { NoticeFilterBar } from '@/components/admin/NoticeFilterBar'
import { NoticeForm } from '@/components/admin/NoticeForm'
import { PageHeader } from '@/components/common/PageHeader'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useNoticeFilters } from '@/hooks/useNoticeFilters'
import { useSubmit } from '@/hooks/useSubmit'
import { apiFetch } from '@/lib/client/api'
import { PRIORITY_COLOR, PRIORITY_LABEL } from '@/lib/shared/constants'
import { formatDate } from '@/lib/shared/format'
import { toRequestParams } from '@/lib/shared/notice-query'
import type { Paginated } from '@/lib/shared/contracts/common'
import type { ChannelStat, NoticeSummaryDto, TagStat } from '@/lib/shared/types'

export function NoticeAdminList() {
  const screens = Grid.useBreakpoint()
  const { query, apply, reset } = useNoticeFilters()
  const { data: channels } = useApiQuery<ChannelStat[]>('/api/channels')
  const { data: tags } = useApiQuery<TagStat[]>('/api/tags', { limit: 60 })
  const { data, loading, error, refresh } = useApiQuery<Paginated<NoticeSummaryDto>>(
    '/api/admin/notices',
    toRequestParams(query),
  )
  const { modal, message } = App.useApp()
  const { run, loading: submitting } = useSubmit()
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingDirty, setEditingDirty] = useState(false)

  const closeEditor = () => {
    if (editingId === null) return
    if (!editingDirty) {
      setEditingId(null)
      return
    }
    modal.confirm({
      title: '放弃修改',
      content: '当前文章还有未保存的改动，关闭后将丢失。',
      okText: '放弃修改',
      okButtonProps: { danger: true },
      cancelText: '继续编辑',
      onOk: () => setEditingId(null),
    })
  }

  const handleEditorClosed = () => {
    setEditingDirty(false)
    setEditingId(null)
    refresh()
  }

  // 组合键或中键保留链接的原生行为，用于另开窗口进入完整编辑页
  const interceptEdit = (event: React.MouseEvent, notice: NoticeSummaryDto) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return
    }
    event.preventDefault()
    setEditingId(notice.id)
  }

  const handleDelete = (notice: NoticeSummaryDto) => {
    modal.confirm({
      title: '删除文章',
      content: `确定删除「${notice.title}」？此操作不可撤销。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        const result = await run(
          () => apiFetch(`/api/admin/notices/${notice.id}`, { method: 'DELETE' }),
          { success: '已删除' },
        )
        if (result) {
          setSelectedKeys((keys) => keys.filter((key) => key !== notice.id))
          refresh()
        }
      },
    })
  }

  const handleBatchDelete = () => {
    if (selectedKeys.length === 0) return
    modal.confirm({
      title: '批量删除',
      content: `确定删除选中的 ${selectedKeys.length} 篇文章？此操作不可撤销。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        const result = await run(
          () =>
            apiFetch<{ deleted: number }>('/api/admin/notices/batch', {
              method: 'POST',
              body: { ids: selectedKeys.map(String) },
            }),
          { success: '已删除' },
        )
        if (result) {
          setSelectedKeys([])
          refresh()
        }
      },
    })
  }

  const copyLink = async (notice: NoticeSummaryDto) => {
    const url = `${window.location.origin}/notices/${notice.id}`
    try {
      await navigator.clipboard.writeText(url)
      message.success('链接已复制')
    } catch {
      message.warning('复制失败，请手动复制')
    }
  }

  const columns: TableColumnsType<NoticeSummaryDto> = [
    {
      title: '封面',
      dataIndex: 'cover',
      width: 72,
      responsive: ['md'],
      render: (_value, record) => (
        <div className="table-cover">
          <MediaImage mediaId={record.cover} alt={record.title} fill sizes="56px" />
        </div>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      render: (_value, record) => (
        <div className="table-title">
          <Link
            href={`/admin/notices/${record.id}/edit`}
            className="table-title-text"
            onClick={(event) => interceptEdit(event, record)}
          >
            {record.title}
          </Link>
          <div className="table-subtitle">{record.summary || '暂无摘要'}</div>
        </div>
      ),
    },
    {
      title: '频道',
      dataIndex: 'channel',
      width: 110,
      responsive: ['lg'],
      render: (value: string) => <Tag variant="filled">{value}</Tag>,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      render: (value: NoticeSummaryDto['priority']) => (
        <span className="priority">
          <span className="priority-dot" style={{ background: PRIORITY_COLOR[value] }} />
          {PRIORITY_LABEL[value]}
        </span>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      width: 180,
      responsive: ['lg'],
      render: (value: string[]) =>
        value.length ? (
          <div className="tag-list">
            {value.slice(0, 3).map((tag) => (
              <Tag key={tag} variant="filled">
                {tag}
              </Tag>
            ))}
          </div>
        ) : (
          <span className="muted">—</span>
        ),
    },
    {
      title: '发布时间',
      dataIndex: 'timestamp',
      width: 160,
      responsive: ['md'],
      render: (value: number) => <span className="nowrap">{formatDate(value, true)}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_value, record) => (
        <div className="row actions">
          <Link
            href={`/admin/notices/${record.id}/edit`}
            onClick={(event) => interceptEdit(event, record)}
          >
            <Button size="small" type="text" icon={<EditOutlined />} aria-label="编辑" />
          </Link>
          <Button
            size="small"
            type="text"
            icon={<CopyOutlined />}
            onClick={() => copyLink(record)}
            aria-label="复制链接"
          />
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            aria-label="删除"
          />
        </div>
      ),
    },
  ]

  return (
    <div className="admin-page">
      <PageHeader
        title="文章列表"
        description="按频道、优先级、标签与时间筛选，支持批量删除。"
        extra={
          <>
            <Link href="/admin/import">
              <Button icon={<ImportOutlined />}>批量导入</Button>
            </Link>
            <Link href="/admin/notices/new">
              <Button type="primary" icon={<PlusOutlined />}>
                新建文章
              </Button>
            </Link>
          </>
        }
      />

      <NoticeFilterBar
        query={query}
        channels={channels ?? []}
        tags={tags ?? []}
        onChange={apply}
        onReset={reset}
      />

      {error ? <ErrorState message={error.message} onRetry={refresh} /> : null}

      {selectedKeys.length > 0 ? (
        <div className="row">
          <span className="muted">已选 {selectedKeys.length} 项</span>
          <Button danger size="small" onClick={handleBatchDelete} loading={submitting}>
            批量删除
          </Button>
        </div>
      ) : null}

      <Table<NoticeSummaryDto>
        size="small"
        rowKey="id"
        columns={columns}
        dataSource={data?.items ?? []}
        loading={loading}
        scroll={screens.md ? { x: 960 } : undefined}
        rowSelection={{
          selectedRowKeys: selectedKeys,
          onChange: setSelectedKeys,
        }}
        locale={{
          emptyText: (
            <EmptyState
              title="还没有文章"
              description="新建一篇文章，或先从别处导入数据"
              action={
                <Link href="/admin/notices/new">
                  <Button type="primary">新建文章</Button>
                </Link>
              }
            />
          ),
        }}
        pagination={{
          current: data?.page ?? query.page,
          pageSize: data?.pageSize ?? query.pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => apply({ page, pageSize }),
        }}
      />

      <Modal
        open={editingId !== null}
        title="编辑文章"
        width="min(1180px, 96vw)"
        style={{ top: 24 }}
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' } }}
        footer={null}
        mask={{ closable: false }}
        destroyOnHidden
        onCancel={closeEditor}
      >
        {editingId ? (
          <NoticeForm
            mode="edit"
            noticeId={editingId}
            embedded
            onCancel={closeEditor}
            onSaved={handleEditorClosed}
            onDirtyChange={setEditingDirty}
          />
        ) : null}
      </Modal>
    </div>
  )
}
