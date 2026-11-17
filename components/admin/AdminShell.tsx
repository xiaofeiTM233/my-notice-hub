// components/admin/AdminShell.tsx
'use client'
import {
  FileTextOutlined,
  FolderOpenOutlined,
  ImportOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { Avatar, Breadcrumb, Button, Drawer, Dropdown, Grid, Layout, Menu } from 'antd'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useState, type ReactNode } from 'react'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { useUIStore } from '@/lib/client/stores/ui'
import { SITE_NAME } from '@/lib/shared/constants'

const MENU_ITEMS = [
  { key: '/admin/notices', icon: <FileTextOutlined />, label: '文章列表' },
  { key: '/admin/notices/new', icon: <PlusOutlined />, label: '新建文章' },
  { key: '/admin/import', icon: <ImportOutlined />, label: '批量导入' },
  { key: '/admin/media', icon: <FolderOpenOutlined />, label: '媒体库' },
  { key: '/admin/settings', icon: <SettingOutlined />, label: '设置' },
]

function resolveSelectedKey(pathname: string): string {
  if (pathname.startsWith('/admin/notices/new')) return '/admin/notices/new'
  if (pathname.startsWith('/admin/notices')) return '/admin/notices'
  if (pathname.startsWith('/admin/import')) return '/admin/import'
  if (pathname.startsWith('/admin/media')) return '/admin/media'
  if (pathname.startsWith('/admin/settings')) return '/admin/settings'
  return '/admin/notices'
}

function breadcrumbItems(pathname: string) {
  const items: { title: ReactNode }[] = [
    { title: <Link href="/admin/notices">管理后台</Link> },
  ]

  if (pathname.startsWith('/admin/notices/new')) items.push({ title: '新建文章' })
  else if (/^\/admin\/notices\/[^/]+\/edit$/.test(pathname)) {
    items.push({ title: <Link href="/admin/notices">文章列表</Link> }, { title: '编辑文章' })
  } else if (pathname.startsWith('/admin/notices')) items.push({ title: '文章列表' })
  else if (pathname.startsWith('/admin/import')) items.push({ title: '批量导入' })
  else if (pathname.startsWith('/admin/media')) items.push({ title: '媒体库' })
  else if (pathname.startsWith('/admin/settings')) items.push({ title: '设置' })

  return items
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const { data: session } = useSession()
  const collapsed = useUIStore((state) => state.siderCollapsed)
  const setCollapsed = useUIStore((state) => state.setSiderCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const menu = (
    <Menu
      mode="inline"
      inlineCollapsed={collapsed && !isMobile}
      selectedKeys={[resolveSelectedKey(pathname)]}
      items={MENU_ITEMS}
      onClick={({ key }) => {
        setDrawerOpen(false)
        router.push(key)
      }}
    />
  )

  const sider = (
    <>
      <div className="admin-sider-brand">
        <span className="brand-mark" aria-hidden>
          {SITE_NAME.slice(0, 1)}
        </span>
        {collapsed && !isMobile ? null : (
          <span className="brand-text">
            <span className="brand-name">{SITE_NAME}</span>
            <span className="brand-sub">Admin</span>
          </span>
        )}
      </div>
      <div className="admin-sider-menu">{menu}</div>
      {isMobile ? null : (
        <div className="admin-sider-footer">
          <Button
            type="text"
            size="small"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? '展开侧栏' : '折叠侧栏'}
          />
        </div>
      )}
    </>
  )

  return (
    <Layout className="admin-shell">
      {isMobile ? null : (
        <aside className={collapsed ? 'admin-sider collapsed' : 'admin-sider'}>{sider}</aside>
      )}

      <div className="admin-main">
        <header className="admin-header">
          <Button
            type="text"
            icon={isMobile ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => (isMobile ? setDrawerOpen(true) : setCollapsed(!collapsed))}
            aria-label="切换侧栏"
          />
          <Breadcrumb items={breadcrumbItems(pathname)} />
          <div className="admin-header-spacer" />
          <ThemeToggle />
          <Dropdown
            menu={{
              items: [
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: '退出登录',
                  onClick: () => signOut({ callbackUrl: '/admin/login' }),
                },
              ],
            }}
            placement="bottomRight"
          >
            <Button type="text">
              <Avatar size={24} style={{ background: 'var(--brand)', fontSize: 12 }}>
                {(session?.user?.username ?? 'A').slice(0, 1).toUpperCase()}
              </Avatar>
              <span className="admin-username">{session?.user?.username ?? '管理员'}</span>
            </Button>
          </Dropdown>
        </header>

        <main className="admin-content">{children}</main>
      </div>

      <Drawer
        open={drawerOpen}
        placement="left"
        size={240}
        onClose={() => setDrawerOpen(false)}
        styles={{ body: { padding: 0 } }}
      >
        {sider}
      </Drawer>
    </Layout>
  )
}
