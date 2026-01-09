-- Seed Installations (United States)
INSERT INTO public.installations (id, name, base_type, acronym, location)
VALUES
  ('MCAS_YUMA', 'Marine Corps Air Station Yuma', 'MCAS', 'MCAS Yuma', 'Arizona'),
  ('MCB_PENDLETON', 'Marine Corps Base Camp Pendleton', 'MCB', 'MCB Camp Pendleton', 'California'),
  ('MCAS_PENDLETON', 'Marine Corps Air Station Camp Pendleton', 'MCAS', 'MCAS Camp Pendleton', 'California'),
  ('MCAS_MIRAMAR', 'Marine Corps Air Station Miramar', 'MCAS', 'MCAS Miramar', 'California'),
  ('MCAGCC_29PALMS', 'Marine Corps Air Ground Combat Center', 'MCAGCC', '29 Palms', 'California'),
  ('MCRD_SANDIEGO', 'Marine Corps Recruit Depot San Diego', 'MCRD', 'MCRD San Diego', 'California'),
  ('MCLB_BARSTOW', 'Marine Corps Logistics Base Barstow', 'MCLB', 'MCLB Barstow', 'California'),
  ('MWTC_BRIDGEPORT', 'Mountain Warfare Training Center', 'MWTC', 'MWTC Bridgeport', 'California'),
  ('MCLB_ALBANY', 'Marine Corps Logistics Base Albany', 'MCLB', 'MCLB Albany', 'Georgia'),
  ('MCB_LEJEUNE', 'Marine Corps Base Camp Lejeune', 'MCB', 'MCB Camp Lejeune', 'North Carolina'),
  ('MCAS_CHERRYPOINT', 'Marine Corps Air Station Cherry Point', 'MCAS', 'MCAS Cherry Point', 'North Carolina'),
  ('MCAS_NEWRIVER', 'Marine Corps Air Station New River', 'MCAS', 'MCAS New River', 'North Carolina'),
  ('MCRD_PARRISLAND', 'Marine Corps Recruit Depot Parris Island', 'MCRD', 'MCRD Parris Island', 'South Carolina'),
  ('MCAS_BEAUFORT', 'Marine Corps Air Station Beaufort', 'MCAS', 'MCAS Beaufort', 'South Carolina'),
  ('MCB_QUANTICO', 'Marine Corps Base Quantico', 'MCB', 'MCB Quantico', 'Virginia'),
  ('HENDERSON_HALL', 'Henderson Hall', 'Barracks', 'MCHH', 'Virginia'),
  ('BARRACKS_8TH_I', 'Marine Barracks, Washington, D.C.', 'Barracks', '8th & I', 'Washington, D.C.')
ON CONFLICT (id) DO NOTHING;

-- Seed Installations (Overseas)
INSERT INTO public.installations (id, name, base_type, acronym, location)
VALUES
  ('MCBH_HAWAII', 'Marine Corps Base Hawaii', 'MCB', 'MCBH', 'Hawaii'),
  ('CAMP_SMITH', 'Camp H. M. Smith', 'Base', 'Camp Smith', 'Hawaii'),
  ('MCAS_IWAKUNI', 'Marine Corps Air Station Iwakuni', 'MCAS', 'MCAS Iwakuni', 'Japan'),
  ('MCB_BUTLER', 'Camp Smedley D. Butler (Okinawa)', 'MCB', 'MCB Butler', 'Japan')
ON CONFLICT (id) DO NOTHING;

-- Seed Major Marine Force Commands (MARFORs)
INSERT INTO public.installations (id, name, base_type, command, acronym, location)
VALUES
  ('MARFOREUR_AF', 'Marine Forces Europe and Africa', 'MARFOR', 'MARFOREUR/AF', 'MARFOREUR/AF', 'Stuttgart, Germany (HQ)'),
  ('MARFORPAC', 'Marine Forces Pacific', 'MARFOR', 'MARFORPAC', 'MARFORPAC', 'Camp H. M. Smith, Hawaii'),
  ('MARFORCENT', 'Marine Forces Central Command', 'MARFOR', 'MARFORCENT', 'MARFORCENT', 'Tampa, Florida (HQ)'),
  ('MARFORCOM', 'Marine Forces Command (Atlantic)', 'MARFOR', 'MARFORCOM', 'MARFORCOM', 'Norfolk, Virginia (HQ)'),
  ('MARFORRES', 'Marine Forces Reserve', 'MARFOR', 'MARFORRES', 'MARFORRES', 'New Orleans, Louisiana (HQ)'),
  ('MARFORSOC', 'Marine Forces Special Operations Command', 'MARFOR', 'MARFORSOC', 'MARFORSOC', 'Camp Lejeune, North Carolina (HQ)')
ON CONFLICT (id) DO NOTHING;
