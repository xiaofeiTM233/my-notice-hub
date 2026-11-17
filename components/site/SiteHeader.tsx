// components/site/SiteHeader.tsx
'use client'
import { SearchOutlined } from '@ant-design/icons'
import { Input } from 'antd'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { useApiQuery } from '@/hooks/useApiQuery'
import { SITE_NAME } from '@/lib/shared/constants'
import type { ChannelStat } from '@/lib/shared/types'

export function SiteHeader() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: channels } = useApiQuery<ChannelStat[]>('/api/channels')

  const activeChannels = searchParams.getAll('channel')
  const keyword = searchParams.get('q') ?? ''
  const navChannels = (channels ?? []).slice(0, 6)

  const handleSearch = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    const trimmed = value.trim()
    if (trimmed) params.set('q', trimmed)
    else params.delete('q')
    params.delete('page')
    const queryString = params.toString()
    router.push(queryString ? `/?${queryString}` : '/')
  }

  return (
    <header className="site-header">
      <div className="site-container site-header-inner">
        <Link href="/" className="site-brand">
          <Image src="/vercel.svg" alt="" width={22} height={22} priority />
          <span>{SITE_NAME}</span>
        </Link>

        <nav className="site-nav" aria-label="频道导航">
          <Link href="/" className={`site-nav-link${activeChannels.length === 0 ? ' active' : ''}`}>
            全部
          </Link>
          {navChannels.map((item) => (
            <Link
              key={item.channel}
              href={`/?channel=${encodeURIComponent(item.channel)}`}
              className={`site-nav-link${activeChannels.includes(item.channel) ? ' active' : ''}`}
            >
              {item.channel}
            </Link>
          ))}
        </nav>

        <div className="site-header-actions">
          <Input.Search
            className="site-search"
            allowClear
            defaultValue={keyword}
            placeholder="搜索公告"
            onSearch={handleSearch}
            enterButton={<SearchOutlined />}
            aria-label="搜索公告"
          />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
