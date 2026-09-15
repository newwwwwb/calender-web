// 내가 만든 공유 링크 목록과 생성/삭제, 링크별 멤버 조회/제거를 다루는 훅 (로그인 상태에서만 동작)
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { SupabaseShareRepository } from '../storage/supabaseShareRepository'
import type { ID, ShareLink, ShareMember } from '../types'
import { useAuth } from './useAuth'

interface ShareLinksState {
  links: ShareLink[]
  membersByShare: Record<ID, ShareMember[]>
  loading: boolean
  createLink: () => Promise<void>
  deleteLink: (id: ID) => Promise<void>
  removeMember: (memberId: ID) => Promise<void>
}

export function useShareLinks(): ShareLinksState {
  const { user } = useAuth()
  const [links, setLinks] = useState<ShareLink[]>([])
  const [membersByShare, setMembersByShare] = useState<Record<ID, ShareMember[]>>({})
  const [loading, setLoading] = useState(true)

  const repo = useMemo(
    () => (user && supabase ? new SupabaseShareRepository(supabase, user.id, user.email ?? '') : null),
    [user],
  )

  const reload = useCallback(async () => {
    if (!repo) {
      setLinks([])
      setMembersByShare({})
      setLoading(false)
      return
    }
    const myLinks = await repo.listMyShareLinks()
    setLinks(myLinks)
    const entries = await Promise.all(myLinks.map(async (link) => [link.id, await repo.listMembers(link.id)] as const))
    setMembersByShare(Object.fromEntries(entries))
    setLoading(false)
  }, [repo])

  useEffect(() => {
    reload()
  }, [reload])

  const createLink = useCallback(async () => {
    if (!repo) return
    await repo.createShareLink()
    await reload()
  }, [repo, reload])

  const deleteLink = useCallback(
    async (id: ID) => {
      if (!repo) return
      await repo.deleteShareLink(id)
      await reload()
    },
    [repo, reload],
  )

  const removeMember = useCallback(
    async (memberId: ID) => {
      if (!repo) return
      await repo.removeMember(memberId)
      await reload()
    },
    [repo, reload],
  )

  return { links, membersByShare, loading, createLink, deleteLink, removeMember }
}
