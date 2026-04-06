interface BadgeProps {
  status: 'active' | 'inactive' | 'blocked'
}

const config = {
  active:   { label: 'Active',   cls: 'bg-green-950 text-green-400' },
  inactive: { label: 'Inactive', cls: 'bg-zinc-800 text-zinc-500'   },
  blocked:  { label: 'Blocked',  cls: 'bg-red-950  text-red-400'    },
}

export function Badge({ status }: BadgeProps) {
  const { label, cls } = config[status]
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}
