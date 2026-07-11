import { type FormEvent, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Input, Modal, useNotice } from '../../components/ui'
import { supabase } from '../../lib/supabase'

interface CreateUserModalProps {
  open: boolean
  onClose: () => void
  onCreated: (userId: string) => void
}

interface CreateUserResponse {
  user: {
    id: string
    email: string
  }
}

export function CreateUserModal({ open, onClose, onCreated }: CreateUserModalProps) {
  const queryClient = useQueryClient()
  const { notify } = useNotice()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function close() {
    if (isSubmitting) return
    setError('')
    onClose()
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const { data, error: invokeError } = await supabase.functions.invoke<CreateUserResponse>('admin-create-user', {
        body: { fullName, email },
      })
      if (invokeError) throw invokeError
      if (!data?.user?.id) throw new Error('The user was not returned by the server')

      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      notify(`Invitation sent to ${data.user.email}.`, 'success')
      setFullName('')
      setEmail('')
      onCreated(data.user.id)
    } catch {
      setError('Couldn’t create this athlete. They may already have an account; please try another email.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Create athlete"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={close} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" form="create-athlete-form" loading={isSubmitting}>Send invitation</Button>
        </>
      }
    >
      <form id="create-athlete-form" className="flex flex-col gap-4" onSubmit={submit}>
        <p className="text-sm leading-relaxed text-text-secondary">
          We’ll create the athlete’s account and send an email invitation so they can securely sign in with a one-time code.
        </p>
        <Input
          id="new-athlete-name"
          label="Full name"
          value={fullName}
          onChange={event => setFullName(event.target.value)}
          placeholder="Jane Doe"
          autoFocus
          required
          maxLength={120}
          disabled={isSubmitting}
        />
        <Input
          id="new-athlete-email"
          label="Email address"
          type="email"
          value={email}
          onChange={event => setEmail(event.target.value)}
          placeholder="jane@example.com"
          required
          maxLength={254}
          disabled={isSubmitting}
        />
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
      </form>
    </Modal>
  )
}
