// components/admin/NoticeForm.tsx
'use client'
import { DeleteOutlined, PictureOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons'
import {
  App,
  AutoComplete,
  Button,
  DatePicker,
  Form,
  Input,
  Segmented,
  Select,
  Skeleton,
  Tag,
} from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ErrorState } from '@/components/common/ErrorState'
import { MediaImage } from '@/components/common/MediaImage'
import { MediaPicker } from '@/components/admin/MediaPicker'
import { PageHeader } from '@/components/common/PageHeader'
import { useApiQuery } from '@/hooks/useApiQuery'
import { apiFetch } from '@/lib/client/api'
import {
  MAX_TAGS_PER_NOTICE,
  NOTICE_PRIORITIES,
  PRIORITY_LABEL,
  type NoticePriority,
} from '@/lib/shared/constants'
import type {
  ChannelStat,
  MediaDto,
  NoticeDetailDto,
  NoticeDetailResponse,
  TagStat,
} from '@/lib/shared/types'

const MarkdownEditor = dynamic(
  () => import('@/components/editor/MarkdownEditor').then((mod) => mod.MarkdownEditor),
  { ssr: false, loading: () => <Skeleton active paragraph={{ rows: 8 }} /> },
)

interface NoticeFormValues {
  title: string
  summary?: string
  channel: string
  priority: NoticePriority
  timestamp?: Dayjs
  tags: string[]
  authorName?: string
  extraText?: string
}

interface NoticeFormProps {
  mode: 'create' | 'edit'
  noticeId?: string
  // 弹窗内嵌模式：隐藏页头并交由宿主决定关闭与保存后的去向
  embedded?: boolean
  onSaved?: (notice: NoticeDetailDto) => void
  onCancel?: () => void
  onDirtyChange?: (dirty: boolean) => void
}

type PickerTarget = 'cover' | 'entities' | 'avatar' | null

export function NoticeForm({
  mode,
  noticeId,
  embedded,
  onSaved,
  onCancel,
  onDirtyChange,
}: NoticeFormProps) {
  const { data, loading, error, refresh } = useApiQuery<NoticeDetailResponse>(
    mode === 'edit' && noticeId ? `/api/admin/notices/${noticeId}` : null,
  )

  if (mode === 'edit' && loading && !data) {
    return (
      <div className={embedded ? 'editor-embedded' : 'admin-page'}>
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    )
  }

  if (mode === 'edit' && error && !data) {
    return (
      <div className={embedded ? 'editor-embedded' : 'admin-page'}>
        <ErrorState message={error.message} onRetry={refresh} />
      </div>
    )
  }

  return (
    <NoticeEditor
      mode={mode}
      noticeId={noticeId}
      notice={data}
      embedded={embedded}
      onSaved={onSaved}
      onCancel={onCancel}
      onDirtyChange={onDirtyChange}
    />
  )
}

function NoticeEditor({
  mode,
  noticeId,
  notice,
  embedded,
  onSaved,
  onCancel,
  onDirtyChange,
}: {
  mode: 'create' | 'edit'
  noticeId?: string
  notice: NoticeDetailResponse | null
  embedded?: boolean
  onSaved?: (notice: NoticeDetailDto) => void
  onCancel?: () => void
  onDirtyChange?: (dirty: boolean) => void
}) {
  const router = useRouter()
  const { message } = App.useApp()
  const [form] = Form.useForm<NoticeFormValues>()
  const [body, setBody] = useState(notice?.body ?? '')
  const [coverId, setCoverId] = useState(notice?.cover ?? '')
  const [entityIds, setEntityIds] = useState<string[]>(notice?.entities ?? [])
  const [authorAvatar, setAuthorAvatar] = useState(notice?.author?.avatar ?? '')
  const [picker, setPicker] = useState<PickerTarget>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const { data: channels } = useApiQuery<ChannelStat[]>('/api/channels')
  const { data: tags } = useApiQuery<TagStat[]>('/api/tags', { limit: 60 })

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const handleSave = async () => {
    const values = await form.validateFields()

    let extra: Record<string, unknown> | undefined
    if (values.extraText?.trim()) {
      try {
        extra = JSON.parse(values.extraText) as Record<string, unknown>
      } catch {
        message.error('扩展字段不是合法 JSON')
        return
      }
    }

    const payload = {
      channel: values.channel.trim(),
      priority: values.priority,
      timestamp: values.timestamp ? values.timestamp.unix() : Math.floor(Date.now() / 1000),
      title: values.title.trim(),
      summary: values.summary?.trim() ?? '',
      body,
      tags: values.tags ?? [],
      cover: coverId,
      entities: entityIds,
      author: { name: values.authorName?.trim() || undefined, avatar: authorAvatar || undefined },
      extra,
    }

    setSaving(true)
    try {
      const saved = await apiFetch<NoticeDetailDto>(
        mode === 'create' ? '/api/admin/notices' : `/api/admin/notices/${noticeId}`,
        { method: mode === 'create' ? 'POST' : 'PATCH', body: payload },
      )
      message.success(mode === 'create' ? '已创建' : '已保存')
      setDirty(false)
      if (onSaved) {
        onSaved(saved)
      } else if (mode === 'create') {
        router.replace(`/admin/notices/${saved.id}/edit`)
        router.refresh()
      }
    } catch (saveError) {
      message.error(saveError instanceof Error ? saveError.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
      return
    }
    router.push('/admin/notices')
  }

  const handlePick = (media: MediaDto[]) => {
    const first = media[0]
    if (!first) {
      setPicker(null)
      return
    }
    if (picker === 'cover') setCoverId(first.id)
    if (picker === 'avatar') setAuthorAvatar(first.id)
    if (picker === 'entities') {
      setEntityIds((prev) => Array.from(new Set([...prev, ...media.map((item) => item.id)])))
    }
    setDirty(true)
    setPicker(null)
  }

  return (
    <div className={embedded ? 'editor-embedded' : 'admin-page'}>
      {embedded ? null : (
        <PageHeader
          title={mode === 'create' ? '新建文章' : '编辑文章'}
          description="正文支持 Markdown 与 HTML；图片会上传到当前媒体存储。"
          extra={
            mode === 'edit' && noticeId ? (
              <Link href={`/notices/${noticeId}`} target="_blank">
                <Button>前台预览</Button>
              </Link>
            ) : null
          }
        />
      )}

      <Form<NoticeFormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{
          title: notice?.title ?? '',
          summary: notice?.summary ?? '',
          channel: notice?.channel ?? '',
          priority: notice?.priority ?? 'normal',
          timestamp: notice ? dayjs(notice.timestamp * 1000) : undefined,
          tags: notice?.tags ?? [],
          authorName: notice?.author?.name ?? '',
          extraText: notice?.extra ? JSON.stringify(notice.extra, null, 2) : '',
        }}
        onValuesChange={() => setDirty(true)}
      >
        <div className="editor-layout">
          <div className="editor-main">
            <div className="admin-panel">
              <Form.Item
                name="title"
                label="标题"
                rules={[{ required: true, message: '请输入标题' }, { max: 200 }]}
              >
                <Input size="large" placeholder="文章标题" showCount maxLength={200} />
              </Form.Item>

              <Form.Item
                name="summary"
                label="摘要"
                extra="列表页展示用，不填时自动取正文前 120 字"
              >
                <Input.TextArea rows={2} maxLength={300} showCount placeholder="可选" />
              </Form.Item>

              <div className="editor-body-label">正文</div>
              <MarkdownEditor
                value={body}
                onChange={(value) => {
                  setBody(value)
                  setDirty(true)
                }}
              />
            </div>
          </div>

          <div className="editor-side">
            <div className="admin-panel">
              <div className="panel-title">发布设置</div>

              <Form.Item
                name="channel"
                label="频道"
                rules={[{ required: true, message: '请填写频道' }]}
              >
                <AutoComplete
                  placeholder="输入或选择频道"
                  options={(channels ?? []).map((item) => ({ value: item.channel }))}
                  filterOption={(input, option) =>
                    String(option?.value ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                />
              </Form.Item>

              <Form.Item name="priority" label="优先级">
                <Segmented
                  block
                  options={NOTICE_PRIORITIES.map((item) => ({
                    value: item,
                    label: PRIORITY_LABEL[item],
                  }))}
                />
              </Form.Item>

              <Form.Item name="timestamp" label="发布时间" extra="留空则使用保存时间">
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item name="tags" label="标签">
                <Select
                  mode="tags"
                  placeholder="回车创建标签"
                  maxCount={MAX_TAGS_PER_NOTICE}
                  options={(tags ?? []).map((item) => ({ value: item.tag }))}
                />
              </Form.Item>

              <Form.Item label="封面">
                {coverId ? (
                  <div className="cover-preview">
                    <MediaImage mediaId={coverId} alt="封面" fill sizes="240px" />
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        setCoverId('')
                        setDirty(true)
                      }}
                    >
                      移除
                    </Button>
                  </div>
                ) : (
                  <Button icon={<PictureOutlined />} onClick={() => setPicker('cover')} block>
                    选择封面
                  </Button>
                )}
              </Form.Item>

              <Form.Item label="附件">
                <div className="attachment-chips">
                  {entityIds.map((id) => (
                    <Tag
                      key={id}
                      closable
                      variant="filled"
                      onClose={() => {
                        setEntityIds((prev) => prev.filter((item) => item !== id))
                        setDirty(true)
                      }}
                    >
                      附件 {id.slice(-6)}
                    </Tag>
                  ))}
                  <Button size="small" icon={<PlusOutlined />} onClick={() => setPicker('entities')}>
                    添加
                  </Button>
                </div>
              </Form.Item>

              <Form.Item name="authorName" label="作者">
                <Input placeholder="可选" maxLength={60} />
              </Form.Item>

              <Form.Item label="作者头像">
                <div className="row">
                  {authorAvatar ? (
                    <div className="avatar-preview">
                      <MediaImage mediaId={authorAvatar} alt="作者头像" fill sizes="40px" />
                    </div>
                  ) : null}
                  <Button size="small" onClick={() => setPicker('avatar')}>
                    {authorAvatar ? '更换' : '选择'}
                  </Button>
                  {authorAvatar ? (
                    <Button
                      size="small"
                      type="text"
                      danger
                      onClick={() => {
                        setAuthorAvatar('')
                        setDirty(true)
                      }}
                    >
                      清除
                    </Button>
                  ) : null}
                </div>
              </Form.Item>

              <details className="extra-json">
                <summary>扩展字段（JSON）</summary>
                <Form.Item name="extraText" noStyle>
                  <Input.TextArea rows={4} className="mono" placeholder='{"source":"import"}' />
                </Form.Item>
              </details>
            </div>
          </div>
        </div>

        <div className="editor-actions">
          <Button onClick={handleCancel}>取消</Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={() => void handleSave()}
          >
            保存
          </Button>
        </div>
      </Form>

      <MediaPicker
        open={picker !== null}
        multiple={picker === 'entities'}
        onCancel={() => setPicker(null)}
        onConfirm={handlePick}
      />
    </div>
  )
}
