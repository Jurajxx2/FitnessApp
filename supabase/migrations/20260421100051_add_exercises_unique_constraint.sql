ALTER TABLE public.exercises
    ADD CONSTRAINT exercises_external_id_source_provider_key UNIQUE (external_id, source_provider);
