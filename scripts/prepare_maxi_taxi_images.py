from pathlib import Path
from PIL import Image

ROOT = Path('/home/ubuntu/silver-service-online')
UPLOAD = Path('/home/ubuntu/upload')
OUT = ROOT / 'public' / 'images' / 'maxi-taxi'
OUT.mkdir(parents=True, exist_ok=True)

# Source files supplied by the user. The duplicate airport and wheelchair files are intentionally mapped once.
IMAGE_MAP = {
    'hero-airport-kia-carnival': 'pasted_file_ACXEyD_sydney_airport_kia_carnival_c699cfa3.jpg',
    'airport-night-hiace': 'pasted_file_Vr8Rfa_airport_night_hiace_b9510f38.jpg',
    'family-baby-seat-kia': 'pasted_file_7TRaA2_baby_seat_kia_ed5d197f.jpg',
    'corporate-kia-barangaroo': 'pasted_file_1BCbJt_corporate_kia_barangaroo_a973ca6b.jpg',
    'group-hiace-bondi': 'pasted_file_ATMDVa_group_hiace_bondi_d906b23c.jpg',
    'luxury-kia-interior': 'pasted_file_tlEDAW_kia_carnival_luxury_interior_d889fbe5.jpg',
    'luxury-sprinter-cbd': 'pasted_file_oovdPc_luxury_sprinter_cbd_39565099.jpg',
    'school-minibus': 'pasted_file_DM7Jiy_minibus_school_ee42d271.jpg',
    'randwick-sprinter-race': 'pasted_file_Dk3EM2_randwick_sprinter_race_f352db41.jpg',
    'rosehill-hiace-raceday': 'pasted_file_GlURec_rosehill_hiace_raceday_f04a98da.jpg',
    'accessible-sprinter-interior': 'pasted_file_AIBRGQ_sprinter_accessible_interior_0c611992.jpg',
    'sydney-cruise-hiace': 'pasted_file_1gYHJw_sydney_cruise_hiace_41822fb3.jpg',
    'wedding-sprinter-opera': 'pasted_file_2IKXo7_wedding_sprinter_opera_9badc744.jpg',
    'wheelchair-ramp-airport': 'pasted_file_ZWlMOt_wheelchair_ramp_airport_6dca15ab.jpg',
    'whitebay-sprinter-cruise': 'pasted_file_znQmus_whitebay_sprinter_cruise_3726d638.jpg',
}

VARIANTS = {
    'full': 1440,
    'card': 900,
    'thumb': 520,
}

manifest = []
for slug, filename in IMAGE_MAP.items():
    src = UPLOAD / filename
    if not src.exists():
        raise FileNotFoundError(src)
    with Image.open(src) as im:
        im = im.convert('RGB')
        width, height = im.size
        for variant, target_width in VARIANTS.items():
            if width > target_width:
                target_height = round(height * target_width / width)
                resized = im.resize((target_width, target_height), Image.Resampling.LANCZOS)
            else:
                resized = im.copy()
            out = OUT / f'{slug}-{variant}.webp'
            resized.save(out, 'WEBP', quality=82, method=6)
            manifest.append((slug, variant, out.relative_to(ROOT), resized.size[0], resized.size[1], out.stat().st_size))

manifest_path = OUT / 'manifest.txt'
manifest_path.write_text('\n'.join(f'{slug}\t{variant}\t{path}\t{w}x{h}\t{size}' for slug, variant, path, w, h, size in manifest) + '\n')
print(f'Prepared {len(manifest)} optimized Maxi Taxi image files in {OUT}')
print(manifest_path)
