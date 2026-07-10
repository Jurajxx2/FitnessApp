test('supabase client is created with configured env', async () => {
  const { supabase } = await import('./supabase')
  expect(supabase).toBeDefined()
  expect(typeof supabase.from).toBe('function')
})
