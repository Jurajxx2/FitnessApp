interface BadgeProps {
  status: 'active' | 'inactive' | 'blocked'
}

const config = {
  active:   { label: 'Active',   cls: 'bg-success/15 text-success' },
  inactive: { label: 'Inactive', cls: 'bg-surface-highest text-text-secondary' },
  blocked:  { label: 'Blocked',  cls: 'bg-error/15 text-error' },
}

export function Badge({ status }: BadgeProps) {
  const { label, cls } = config[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  )
}
