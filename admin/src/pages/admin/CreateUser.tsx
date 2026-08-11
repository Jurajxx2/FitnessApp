import { type FormEvent, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Mail, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, EditorPage, FormSection, Input, useNotice } from '../../components/ui'
import { supabase } from '../../lib/supabase'

type CreateUserResponse =
  | { user: { id: string } }
  | { status: 'pending'; error: string; requestId: string }

export default function CreateUser({ onCreated }: { onCreated?: (userId: string) => void }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotice()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const requestIdRef = useRef<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      requestIdRef.current ??= crypto.randomUUID()
      const { data, error: invokeError, response } = await supabase.functions.invoke<CreateUserResponse>('admin-create-user', {
        body: { fullName: fullName.trim(), email: email.trim() },
        headers: { 'x-request-id': requestIdRef.current },
      })
      if (invokeError) {
        if (response && response.status >= 400 && response.status < 500 && response.status !== 408) {
          requestIdRef.current = null
        }
        throw invokeError
      }
      if (data && 'status' in data && data.status === 'pending') {
        setError('Invitation status is still being confirmed. Retry safely in a moment.')
        return
      }
      if (!data || !('user' in data) || !data.user.id) throw new Error('The user was not returned by the server')

      requestIdRef.current = null
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      notify(`Invitation sent to ${email.trim().toLowerCase()}.`, 'success')
      if (onCreated) onCreated(data.user.id)
      else navigate(`/admin/users/${data.user.id}`, { replace: true })
    } catch {
      setError('Couldn’t create this athlete. They may already have an account; please try another email.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <EditorPage
      backTo="/admin/users"
      backLabel="Back to athletes"
      eyebrow="Athlete account"
      title="Create athlete"
      description="Create a client account and send a secure email invitation. You’ll land on their profile as soon as the account is ready."
      maxWidth="5xl"
      actions={
        <>
          <Button type="button" variant="ghost" onClick={() => navigate('/admin/users')} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" form="create-athlete-form" loading={isSubmitting}>Send invitation</Button>
        </>
      }
      aside={
        <div className="space-y-4">
          <Card>
            <Mail size={19} className="text-accent" aria-hidden="true" />
            <h2 className="mt-3 font-bold text-text-primary">What the athlete receives</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">They receive an email invitation, sign in securely with a one-time code, and complete onboarding.</p>
          </Card>
          <Card>
            <ShieldCheck size={19} className="text-success" aria-hidden="true" />
            <h2 className="mt-3 font-bold text-text-primary">Admin-safe provisioning</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">The account is created through the protected admin service, so no admin credentials or elevated keys are exposed in this browser.</p>
          </Card>
        </div>
      }
    >
      <FormSection title="Athlete details" description="Use the name and email the athlete should recognize in their invitation.">
        <form id="create-athlete-form" className="grid gap-5" onSubmit={submit}>
          <Input
            id="new-athlete-name"
            label="Full name"
            value={fullName}
            onChange={event => {
              requestIdRef.current = null
              setFullName(event.target.value)
            }}
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
            onChange={event => {
              requestIdRef.current = null
              setEmail(event.target.value)
            }}
            placeholder="jane@example.com"
            required
            maxLength={254}
            disabled={isSubmitting}
          />
          {error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{error}</p>}
        </form>
      </FormSection>
    </EditorPage>
  )
}
