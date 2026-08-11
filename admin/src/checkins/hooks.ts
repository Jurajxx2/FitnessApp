import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import {
  checkInKeys,
  fetchCheckInForWeek,
  fetchCheckIns,
  saveCheckIn,
  uploadCheckInPhoto,
  type CheckInDraft,
} from './api'
import { currentWeekMondayIso } from './date'

export function useCheckIns(page = 0, pageSize = 12) {
  const { user } = useAuth()
  return useQuery({
    queryKey: checkInKeys.page(user?.id ?? '', page, pageSize),
    queryFn: () => fetchCheckIns(user!.id, page, pageSize),
    enabled: !!user,
    placeholderData: keepPreviousData,
  })
}

export function useCurrentCheckIn() {
  const { user } = useAuth()
  const weekOf = currentWeekMondayIso()
  return useQuery({
    queryKey: checkInKeys.week(user?.id ?? '', weekOf),
    queryFn: () => fetchCheckInForWeek(user!.id, weekOf),
    enabled: !!user,
  })
}

export function useUploadCheckInPhoto() {
  return useMutation({
    mutationFn: ({ slot, file }: { slot: 'front' | 'side'; file: File }) =>
      uploadCheckInPhoto(currentWeekMondayIso(), slot, file),
  })
}

export function useSaveCheckIn() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const weekOf = currentWeekMondayIso()
  return useMutation({
    mutationFn: ({ draft, previousWeight }: { draft: CheckInDraft; previousWeight: number | null }) =>
      saveCheckIn(user!.id, weekOf, draft, previousWeight),
    onSuccess: saved => {
      queryClient.setQueryData(checkInKeys.week(user!.id, weekOf), saved)
      queryClient.invalidateQueries({ queryKey: checkInKeys.all(user!.id) })
    },
  })
}
