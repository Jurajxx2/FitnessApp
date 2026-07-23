import { KeyboardEvent, ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface ActionMenuItem {
  key: string
  label: string
  icon?: ReactNode
  onSelect: () => void
  variant?: 'default' | 'danger'
  disabled?: boolean
}

interface ActionMenuProps {
  items: ActionMenuItem[]
  label?: string
}

const MENU_WIDTH = 208

export function ActionMenu({ items, label = 'Actions' }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const menuId = useId()

  const enabledIndexes = items.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i >= 0)

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8))
    setCoords({ top: rect.bottom + 4, left })
  }, [open])

  useEffect(() => {
    if (!open) return
    const first = enabledIndexes[0] ?? -1
    setActiveIndex(first)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && activeIndex >= 0) itemRefs.current[activeIndex]?.focus()
  }, [open, activeIndex])

  useEffect(() => {
    if (!open) return
    const onDocPointer = (event: MouseEvent) => {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    const onDismiss = () => setOpen(false)
    document.addEventListener('mousedown', onDocPointer)
    window.addEventListener('resize', onDismiss)
    window.addEventListener('scroll', onDismiss, true)
    return () => {
      document.removeEventListener('mousedown', onDocPointer)
      window.removeEventListener('resize', onDismiss)
      window.removeEventListener('scroll', onDismiss, true)
    }
  }, [open])

  function close(restoreFocus = true) {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  function select(item: ActionMenuItem) {
    if (item.disabled) return
    setOpen(false)
    item.onSelect()
  }

  function moveActive(direction: 1 | -1) {
    if (enabledIndexes.length === 0) return
    const pos = enabledIndexes.indexOf(activeIndex)
    const nextPos = pos === -1 ? 0 : (pos + direction + enabledIndexes.length) % enabledIndexes.length
    setActiveIndex(enabledIndexes[nextPos])
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') { event.preventDefault(); close() }
    else if (event.key === 'ArrowDown') { event.preventDefault(); moveActive(1) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); moveActive(-1) }
    else if (event.key === 'Home') { event.preventDefault(); setActiveIndex(enabledIndexes[0] ?? -1) }
    else if (event.key === 'End') { event.preventDefault(); setActiveIndex(enabledIndexes[enabledIndexes.length - 1] ?? -1) }
    else if (event.key === 'Tab') { close(false) }
  }

  if (items.length === 0) return null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onTriggerKeyDown}
        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-transparent bg-transparent text-text-secondary transition-colors hover:bg-surface-highest hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
      >
        <MoreVertical size={18} aria-hidden="true" />
      </button>
      {open && coords && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: MENU_WIDTH, zIndex: 60 }}
          className="overflow-hidden rounded-xl border border-outline bg-surface-elevated py-1 shadow-xl"
        >
          {items.map((item, index) => (
            <button
              key={item.key}
              ref={(el) => { itemRefs.current[index] = el }}
              role="menuitem"
              type="button"
              tabIndex={-1}
              disabled={item.disabled}
              onClick={() => select(item)}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                item.variant === 'danger' ? 'text-error hover:bg-error/10' : 'text-text-primary hover:bg-surface-highest',
              )}
            >
              {item.icon && <span className="flex h-4 w-4 items-center justify-center" aria-hidden="true">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
