import { ReactNode } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel?: string
  confirmVariant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  pending?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  confirmVariant = 'danger',
  pending = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button variant={confirmVariant} onClick={onConfirm} loading={pending}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="text-sm leading-6 text-text-secondary">{description}</p>
    </Modal>
  )
}
