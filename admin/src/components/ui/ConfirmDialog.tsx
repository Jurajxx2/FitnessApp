import { ReactNode } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  pending?: boolean
  onConfirm: () => void
  onClose: () => void
  locale?: 'sk' | 'en'
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  pending = false,
  onConfirm,
  onClose,
  locale,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      locale={locale}
      footer={
        <>
          <Button variant="ghost" className="min-h-11" onClick={onClose} disabled={pending}>{cancelLabel}</Button>
          <Button variant={confirmVariant} className="min-h-11" onClick={onConfirm} loading={pending}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="text-sm leading-6 text-text-secondary">{description}</p>
    </Modal>
  )
}
