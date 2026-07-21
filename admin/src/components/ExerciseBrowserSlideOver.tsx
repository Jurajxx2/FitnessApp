import { ExercisePicker, type ExercisePickerItem } from './ExercisePicker'
import { Button, SlideOver } from './ui'

interface ExerciseBrowserSlideOverProps {
  open: boolean
  onClose: () => void
  selectedIds: string[]
  onAdd: (exercise: ExercisePickerItem) => void
}

export function ExerciseBrowserSlideOver({ open, onClose, selectedIds, onAdd }: ExerciseBrowserSlideOverProps) {
  return (
    <SlideOver open={open} onClose={onClose} title="Browse exercises">
      <ExercisePicker locale="en" selectedIds={selectedIds} onAdd={onAdd} />
      <div className="mt-6 flex justify-end">
        <Button onClick={onClose}>Done</Button>
      </div>
    </SlideOver>
  )
}
