// app/api/channels/route.ts
import { withApi } from '@/lib/server/respond'
import { getChannelStats } from '@/lib/server/queries/notice'

export const GET = withApi(async () => getChannelStats())
