alter table public.animals
  add column if not exists intro_title text not null default 'Potencia, estructura',
  add column if not exists intro_emphasis text not null default 'y corrección.',
  add column if not exists intro_secondary text not null default 'Su pedigree reúne líneas probadas de nuestro programa genético con referentes internacionales de la raza.',
  add column if not exists pedigree_title text not null default 'Pedigree de',
  add column if not exists pedigree_emphasis text not null default 'tres generaciones.',
  add column if not exists pedigree_description text not null default 'Una genealogía sólida, construida sobre padres y madres que marcaron nuestro rodeo.';
