-- Ajustes propios de esta instancia independiente de Cabaña Tupambaé.
-- Se ejecuta después de las migraciones heredadas de la plantilla.
alter table public.animals alter column breed set default 'Hereford';
alter table public.animals alter column image set default '/tupambae-animal-placeholder.svg';
alter table public.auctions alter column image set default '/tupambae-establishment.jpg';
alter table public.news_posts alter column image set default '/tupambae-establishment.jpg';

-- Solo modifica los valores heredados de la plantilla; respeta datos personalizados.
update public.animals set breed = 'Hereford' where breed = 'Aberdeen Angus';
update public.animals set image = '/tupambae-animal-placeholder.svg' where image = '/animal-black.jpg';
update public.auctions set image = '/tupambae-establishment.jpg' where image = '/ranch.jpg';
update public.news_posts set image = '/tupambae-establishment.jpg' where image = '/ranch.jpg';
