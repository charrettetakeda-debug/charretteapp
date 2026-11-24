-- Quem está logado (ex.: cliente de outra charrette) também consegue mandar fotos pelo link público
drop policy "arquivos: enviar" on storage.objects;
create policy "arquivos: enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'charrette-arquivos' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select privado.is_equipe())
    or ((storage.foldername(name))[1] = 'publico' and privado.envio_aberto((storage.foldername(name))[2]))
  ));
