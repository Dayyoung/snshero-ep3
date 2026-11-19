#!/usr/bin/env python3
"""
SNSHero Studio Anime — Keyframe Upscaler & Continuity Bible Generator (curator)

Reads `output/studio_anime/ep{N:02d}_en/storyboard_ep{N:02d}_en.json`,
upscales every cut's `sourceWebtoonFile` (768x432 16:9 WebP) to crisp 1280x720 PNG
keyframes using Pillow LANCZOS + subtle UnsharpMask, and emits
`output/studio_anime/ep{N:02d}_en/continuity_bible_ep{N:02d}.json` for downstream
Veo 3.1 prompt generation.

Usage:
    python3 scripts/studio_anime/prepare_keyframes.py --ep 1
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

from PIL import Image, ImageFilter

REPO_ROOT = Path(__file__).resolve().parents[2]

VEO_SAFE_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bblood-stained\b", re.IGNORECASE), "crimson-stained"),
    (re.compile(r"\bblood-red\b", re.IGNORECASE), "crimson-red"),
    (re.compile(r"\bbloody\b", re.IGNORECASE), "crimson"),
    (re.compile(r"\bblood\b", re.IGNORECASE), "crimson"),
    (re.compile(r"\bsevered\b", re.IGNORECASE), "parted"),
    (re.compile(r"\bcorpse\b", re.IGNORECASE), "fallen figure"),
    (re.compile(r"\bslaughter\b", re.IGNORECASE), "clash"),
    (re.compile(r"\bmassacre\b", re.IGNORECASE), "raid"),
    (re.compile(r"\bkill(ed|ing|s)?\b", re.IGNORECASE), "defeat"),
]


def sanitize_veo_text(text: str) -> str:
    out = text
    for pat, repl in VEO_SAFE_PATTERNS:
        out = pat.sub(repl, out)
    return out

# ---------------------------------------------------------------------------
# Canonical Visual & Continuity Profiles (EP01 & Series-Wide Dark Fantasy Lore)
# Zero copyrighted studio/brand names; Veo-safe cinematic descriptors only.
# ---------------------------------------------------------------------------

CANONICAL_CHARACTERS: dict[str, dict[str, Any]] = {
    "Aleksandar": {
        "canonicalName": "Aleksandar",
        "aliases": ["aleksandar", "alexander"],
        "role": "Northern border hunter & hidden heir of the Arcane Holy Knights; husband of Elwin, father of unborn Kadan",
        "hair": "shoulder-length windswept dark charcoal-black hair with frost-dusted strands",
        "eyesAndExpression": "sharp steel-grey eyes, stoic northern resolve, furrowed brow under stormlight",
        "armorAndOutfit": "weathered charcoal-slate fur-lined winter cloak over dark leather brigandine, worn iron pauldrons, wrapped leather gauntlets",
        "weapon": "twin curved northern lightning swords with etched azure rune fullers",
        "signatureVfx": "crackling cobalt-and-white lightning ribbons trailing twin blade arcs",
        "voiceToneEn": "deep, steady, gravelly spoken baritone; restrained northern stoicism breaking into firm protective grit in combat",
        "continuityAnchor": "Aleksandar: tall dark-haired northern warrior in fur-trimmed charcoal cloak and dark leather armor wielding twin lightning-etched blades",
    },
    "Balian": {
        "canonicalName": "Balian",
        "aliases": ["balian"],
        "role": "Seasoned frontier veteran & Arcane Holy Knight descendant; husband of Ysela, father of unborn Ignis",
        "hair": "cropped iron-grey-streaked dark brown hair with rugged short beard",
        "eyesAndExpression": "fierce amber-hazel eyes burning with veteran grit and unwavering loyalty",
        "armorAndOutfit": "heavy quilted winter gambeson, scarred bronze-iron chest plate, crimson-brown wool mantle dusted with snow",
        "weapon": "long arcane flame spear with engraved steel leaf-blade head",
        "signatureVfx": "swirling azure-and-amber arcane flame ribbons spiralling along the spearhead",
        "voiceToneEn": "rough, seasoned, gravelly spoken veteran baritone; gruff warmth with allies and forceful conviction in sacrifice",
        "continuityAnchor": "Balian: broad-shouldered bearded veteran in scarred iron-bronze armor and rust-brown winter mantle wielding an arcane flame spear",
    },
    "Hercul": {
        "canonicalName": "Hercul",
        "aliases": ["hercul", "hercules"],
        "role": "Wandering surviving Holy Knight paladin investigating the Shadow Realm conspiracy",
        "hair": "tousled silver-streaked ash-brown hair partially shadowed beneath a tattered hood",
        "eyesAndExpression": "weary, solemn gold-flecked eyes carrying hardened sorrow and quiet resolve",
        "armorAndOutfit": "tattered ivory-and-slate pilgrim cloak over cracked golden Holy Knight tabard and mud-caked greaves, torn iron gauntlets leaking faint golden runes",
        "weapon": "heavy runic holy warhammer and defensive golden mana aegis; carries cracked golden seal and silver daggers",
        "signatureVfx": "warm translucent golden rune-barrier dome and floating incandescent motes",
        "voiceToneEn": "solemn, weathered, steady spoken elder baritone; calm direct authority",
        "continuityAnchor": "Hercul: hooded wandering Holy Knight in tattered pilgrim cloak over golden tabard, cracked belt seal, runic warhammer, faint golden mana from torn gauntlets",
    },
    "Elwin": {
        "canonicalName": "Elwin",
        "aliases": ["elwin"],
        "role": "Heavily pregnant wife of Aleksandar, mother of Kadan; embodies enduring mercy and unbroken vow",
        "hair": "long warm chestnut-brown hair loosely braided over one shoulder, strands whipped by blizzard wind",
        "eyesAndExpression": "luminous hazel-brown eyes, gentle compassion hardening into tear-streaked iron resolve",
        "armorAndOutfit": "thick woven cream-and-forest wool winter cloak draped over a simple homespun frontier dress protecting her pregnant belly",
        "weapon": "unarmed; guards Aleksandar's broken sword-sheath, the rune-etched silver dagger, and golden wheat seeds",
        "signatureVfx": "faint pale-blue rune shimmer beneath her cloak and warm golden gleam on wheat seeds against white snow",
        "voiceToneEn": "warm, clear, heartfelt spoken mezzo-soprano; quiet grief steadied by firm resolve",
        "continuityAnchor": "Elwin: expectant young woman with braided chestnut hair in a heavy cream-and-forest wool winter cloak shielding her belly",
    },
    "Ysela": {
        "canonicalName": "Ysela",
        "aliases": ["ysela"],
        "role": "Expectant wife of Balian, mother of Ignis; fiercely defiant even when cornered",
        "hair": "wavy auburn-red hair spilling from a winter scarf",
        "eyesAndExpression": "fierce emerald-hazel eyes flashing with defiance and maternal courage",
        "armorAndOutfit": "heavy charcoal-and-burgundy wool shawl over sturdy village winter tunic, snow-spattered hem",
        "weapon": "unarmed; shields her unborn child with both arms",
        "signatureVfx": "whirling snow spray and drifting firelight embers",
        "voiceToneEn": "sharp, direct, defiant spoken alto-mezzo; fierce urgency cutting through chaos",
        "continuityAnchor": "Ysela: expectant woman with wavy auburn hair in a burgundy-and-charcoal winter shawl shielding her belly",
    },
    "Lucian": {
        "canonicalName": "Lucian",
        "aliases": ["lucian"],
        "role": "Ambitious, manipulative highborn courtier of the Red Glass Court orchestrating the raid on Elwin village",
        "hair": "sleek, neatly parted platinum-pale blond hair framing a sharp aristocratic face",
        "eyesAndExpression": "cold, narrow crimson-amber eyes, cruel sneer and possessive arrogance",
        "armorAndOutfit": "ornate crimson-and-black velvet noble coat trimmed with white ermine fur, gilded silver filigree pauldrons, serpentine Red Glass Court crest",
        "weapon": "gilded courtier rapier at hip; commands mounted imperial legionnaires from warhorse",
        "signatureVfx": "cold crimson-violet rim light and drifting dark ember ash",
        "voiceToneEn": "crisp, aristocratic, cold spoken mid-tenor; mocking condescension and sharp menace",
        "continuityAnchor": "Lucian: pale blond aristocratic courtier in crimson-black ermine-trimmed noble cloak with gilded serpentine crest",
    },
    "Grimli": {
        "canonicalName": "Grimli",
        "aliases": ["grimli", "dwarf", "blacksmith"],
        "role": "Broad-shouldered dwarven blacksmith and frontline bruiser of the Seven Pursuers",
        "hair": "thick braided iron-brown beard and rugged cropped hair",
        "eyesAndExpression": "fierce squinting charcoal eyes beneath heavy brows, rough frontier grit",
        "armorAndOutfit": "heavy soot-stained leather blacksmith apron over scarred iron-plated pauldrons and thick fur gauntlets",
        "weapon": "colossal forged iron war-maul rested across his shoulders",
        "signatureVfx": "heavy kinetic shockwave rings and flying iron sparks on impact",
        "voiceToneEn": "rough, gravelly, booming spoken bass-baritone; blunt frontier gruffness",
        "continuityAnchor": "Grimli: broad-shouldered bearded dwarven blacksmith in scarred iron pauldrons and leather apron carrying a colossal iron maul",
    },
    "Aila": {
        "canonicalName": "Aila",
        "aliases": ["aila", "demon hunter"],
        "role": "Sharp-eyed Demon Hunter and ranged marksman of the Seven Pursuers",
        "hair": "vibrant scarlet-red hair drawn back in tight combat braids",
        "eyesAndExpression": "narrowed piercing hazel eyes, fierce protective focus",
        "armorAndOutfit": "fitted dark charcoal-and-crimson leather hunter coat with reinforced shoulder guards and bolt quiver across hip",
        "weapon": "heavy mechanical dark-steel crossbow loaded with silver-tipped quarrels",
        "signatureVfx": "gleaming silver bolt streaks slicing through harbor mist",
        "voiceToneEn": "crisp, sharp, commanding spoken alto; rapid tactical urgency",
        "continuityAnchor": "Aila: lean hunter with tight scarlet braids in dark crimson-trimmed leather coat aiming a heavy steel crossbow",
    },
    "Eliana": {
        "canonicalName": "Eliana",
        "aliases": ["eliana", "apothecary"],
        "role": "Frontier apothecary and alchemist of the Seven Pursuers",
        "hair": "soft wavy dark-olive-brown hair tucked beneath a practical herbalist hood",
        "eyesAndExpression": "calm, observant amber-green eyes",
        "armorAndOutfit": "layered forest-green and tan traveler cloak slung with leather herb-pouches, bandolier of glass vials, and wrapped cuffs",
        "weapon": "alchemical sun-pepper vapor vials and herbalist remedies",
        "signatureVfx": "billowing amber-gold alchemical vapor clouds and glowing dust",
        "voiceToneEn": "calm, articulate, steady spoken mezzo-soprano; practical warmth",
        "continuityAnchor": "Eliana: hooded frontier apothecary in forest-green cloak lined with leather herb pouches and glass vials",
    },
    "Gawain": {
        "canonicalName": "Gawain",
        "aliases": ["gawain", "blind tracker"],
        "role": "Blind frontier tracker and calm moral compass of the Seven Pursuers",
        "hair": "streaked silver-grey hair tied back neatly, weathered lean face",
        "eyesAndExpression": "pale clouded sightless eyes framed by serene, razor-sharp composure",
        "armorAndOutfit": "long slate-grey and weathered navy traveler coat with high collar and wrapped forearms",
        "weapon": "tall dark-iron tracker staff used to sense ground vibrations and parry strikes",
        "signatureVfx": "subtle concentric pale-blue tremor ripples radiating across wet cobblestones from his staff tip",
        "voiceToneEn": "calm, dignified, steady spoken mid-baritone; measured authority",
        "continuityAnchor": "Gawain: lean silver-haired blind tracker in long slate-grey coat gripping a tall dark-iron staff",
    },
    "Kaze": {
        "canonicalName": "Kaze",
        "aliases": ["kaze", "gambler"],
        "role": "Flamboyant gambler and precision blade-and-coin tactician of the Seven Pursuers",
        "hair": "windswept jet-black hair falling playfully across one brow",
        "eyesAndExpression": "keen, mischievous dark-gold eyes with a confident half-smirk",
        "armorAndOutfit": "tailored midnight-indigo and silver-trimmed gambler's coat with loose cuffs and concealed dagger belt",
        "weapon": "seven gleaming silver shillings and concealed throwing daggers",
        "signatureVfx": "glinting silver coin arcs tracing precision fracture lines in midair",
        "voiceToneEn": "quick, wry, confident spoken tenor; sharp playful banter",
        "continuityAnchor": "Kaze: nimble black-haired gambler in midnight-indigo silver-trimmed coat flicking gleaming silver coins",
    },
    "Rondol": {
        "canonicalName": "Rondol",
        "aliases": ["rondol", "boatman"],
        "role": "Canal boatman and hydro-rune wielder of the Seven Pursuers",
        "hair": "sun-weathered dark brown hair tied under a damp maritime headband",
        "eyesAndExpression": "steady storm-blue eyes, weathered dockworker grit",
        "armorAndOutfit": "heavy waxed sea-blue oilskin vest over rolled-sleeve linen shirt, rope belt, waterproof dock boots",
        "weapon": "carved hardwood canal oar inlaid with glowing hydro-control runes",
        "signatureVfx": "surging teal-white canal water ribbons freezing into jagged frost spikes",
        "voiceToneEn": "deep, steady, weathered spoken baritone; calm harbor grit",
        "continuityAnchor": "Rondol: sturdy dock boatman in dark sea-blue oilskin vest wielding a rune-carved wooden canal oar",
    },
    "Robinyard": {
        "canonicalName": "Robinyard",
        "aliases": ["robinyard", "acrobat"],
        "role": "Agile rooftop acrobat and scout of the Seven Pursuers",
        "hair": "short tousled sandy-brown hair catching the harbor breeze",
        "eyesAndExpression": "bright alert green eyes, fearless grin",
        "armorAndOutfit": "lightweight fitted olive-and-charcoal leather acrobat tunic, fingerless climbing wraps, fluttering scarf",
        "weapon": "unarmed rooftop agility and weighted balance cords",
        "signatureVfx": "crisp motion-blur wind trails across wet tiled eaves",
        "voiceToneEn": "light, nimble, earnest spoken young tenor; energetic clarity",
        "continuityAnchor": "Robinyard: lithe sandy-haired acrobat in fitted olive-charcoal leather and fluttering scarf perched on rooftops",
    },
    "Orphan Girl": {
        "canonicalName": "Orphan Girl",
        "aliases": ["orphan girl", "young girl", "ragged girl", "child", "girl"],
        "role": "Rescued harbor orphan whose desperate plea halts the clash between Hercul and the Seven Pursuers",
        "hair": "tangled dark-brown chin-length hair smudged with harbor soot",
        "eyesAndExpression": "wide tear-filled brown eyes pleading with raw honesty",
        "armorAndOutfit": "oversized patched grey-brown wool rags and worn boots",
        "weapon": "none",
        "signatureVfx": "falling mist droplets and warm lantern rim light",
        "voiceToneEn": "trembling, earnest, clear spoken young child's voice",
        "continuityAnchor": "Orphan Girl: small soot-streaked child in ragged patched wool tunic clutching Hercul's torn surcoat",
    },
    "Kadan": {
        "canonicalName": "Kadan",
        "aliases": ["kadan", "young kadan", "boy"],
        "role": "Son of Aleksandar and Elwin; sturdy northern frontier boy raised in the Wildlands and trained by the Pursuers",
        "hair": "tousled short dark-charcoal hair dusted with frost or rain",
        "eyesAndExpression": "clear determined steel-grey eyes, earnest stoic focus",
        "armorAndOutfit": "rough fur-trimmed nomad sheepskin tunic and layered wool wraps with worn leather boots",
        "weapon": "Aleksandar's heirloom rune-etched silver dagger and frontier training blade",
        "signatureVfx": "subtle frost-blue dagger rune glow and crisp concentric acoustic perception ripples",
        "voiceToneEn": "earnest, steady, clear spoken young boy's voice; quiet northern determination",
        "continuityAnchor": "Kadan: sturdy dark-haired northern boy in fur-trimmed rough nomad tunic wearing his father's silver dagger",
    },
    "Medusa Gorgo": {
        "canonicalName": "Medusa Gorgo",
        "aliases": ["medusa gorgo", "gorgo", "medusa", "witch"],
        "role": "Banished shadow-wind sorceress hunting the Pursuers and Kadan through mist and storm",
        "hair": "long writhing midnight-violet hair whipping like wind-blown ribbons",
        "eyesAndExpression": "cold pale predatory gaze (or eyes bound in a sleek black silk blindfold in EP05)",
        "armorAndOutfit": "flowing tattered obsidian-and-deep-violet shadow cloak with jagged silver-black shoulder ornaments",
        "weapon": "razor-sharp curved obsidian talons and shadow-wind sorcery",
        "signatureVfx": "fading violet shadow afterimages, dark wind-vortex trails, eerie purple lightning sheen",
        "voiceToneEn": "cold, sharp, rasping spoken contralto; icy mockery and taut menace",
        "continuityAnchor": "Medusa Gorgo: slender shadow sorceress in tattered obsidian-violet cloak with curved dark talons and black silk blindfold",
    },
    "Belphegor": {
        "canonicalName": "Belphegor",
        "aliases": ["belphegor", "crystal-shaper", "crystal shaper"],
        "role": "Banished crystal-shaper sorcerer partnering with Gorgo atop Mistfall Cliff",
        "hair": "gaunt pale-ash hair streaked over a hollow angular face",
        "eyesAndExpression": "glowing cold amethyst eyes, fanatical narrow stare",
        "armorAndOutfit": "heavy charcoal-and-slate ritual robes encrusted with jagged dark crystal shards along collar and cuffs",
        "weapon": "levitating jagged obsidian-amethyst crystal spires and dark codex sigils",
        "signatureVfx": "fracturing violet crystal shards, swirling dark mist tendrils, pulsing amethyst geometric runes",
        "voiceToneEn": "dry, hollow, sharp spoken tenor; cold clinical arrogance",
        "continuityAnchor": "Belphegor: gaunt ash-haired crystal sorcerer in dark crystal-encrusted robes summoning jagged amethyst shards",
    },
    "Gilgamesh": {
        "canonicalName": "Gilgamesh",
        "aliases": ["gilgamesh"],
        "role": "Young proud heir of Conqueror King Fenrir of the northern nomad clans",
        "hair": "thick braided golden-amber hair with bone-and-brass nomad clasps",
        "eyesAndExpression": "bright fierce amber eyes, proud royal bearing tempered by gratitude",
        "armorAndOutfit": "heavy wolf-fur-lined crimson-and-gold nomad prince coat over studded leather lamellar",
        "weapon": "curved northern nomad saber and short horn bow",
        "signatureVfx": "swirling snow gusts catching his crimson-gold cloak",
        "voiceToneEn": "bold, clear, proud spoken youth tenor; direct royal confidence",
        "continuityAnchor": "Gilgamesh: golden-haired nomad prince in wolf-fur crimson-gold tribal coat with brass clasps",
    },
    "Fenrir": {
        "canonicalName": "Fenrir",
        "aliases": ["fenrir", "conqueror king", "king fenrir"],
        "role": "Towering Conqueror King of the northern Wildlands nomad confederation",
        "hair": "mane-like silver-streaked tawny hair and heavy braided war-beard",
        "eyesAndExpression": "commanding amber eyes, weathered scars, iron sovereign presence",
        "armorAndOutfit": "massive white-wolf pelt mantle over bronze-and-iron tribal warplate",
        "weapon": "broad northern nomad greatsword",
        "signatureVfx": "billowing snow mantle and cold frontier rim light",
        "voiceToneEn": "deep, commanding, gravelly spoken bass-baritone; sovereign authority",
        "continuityAnchor": "Fenrir: towering bearded northern nomad king in massive white-wolf pelt mantle and bronze-iron warplate",
    },
    "Imperial Legionnaires": {
        "canonicalName": "Imperial Legionnaires",
        "aliases": ["legionnaires", "soldiers", "cavalry", "inquisitors", "commander", "guards", "imperial"],
        "role": "Iron-clad royal inquisitor troops and mounted cavalry enforcing Lucian's fabricated treason decree",
        "hair": "concealed beneath closed dark-iron nasal helms",
        "eyesAndExpression": "shadowed visors reflecting firelight",
        "armorAndOutfit": "uniform dark-iron lamellar breastplates, crimson-trimmed winter cloaks, round iron shields and long steel halberds/spears",
        "weapon": "iron spears, halberds, burning pitch torches, heavy iron chains",
        "signatureVfx": "blazing torch sparks, trailing dark smoke, clashing steel sparks",
        "voiceToneEn": "muffled armored battle shouts (silent during sakuga cuts)",
        "continuityAnchor": "Imperial Legionnaires: faceless dark-iron helmeted soldiers with crimson cloaks, iron shields, spears, and blazing torches",
    },
    "Village Refugees": {
        "canonicalName": "Village Refugees",
        "aliases": ["villagers", "refugees", "elders", "elderly"],
        "role": "Surviving frontier villagers fleeing the burning settlement of Elwin",
        "hair": "frost-covered grey and brown hair under wool hoods",
        "eyesAndExpression": "weary, grieving, huddled against the gale",
        "armorAndOutfit": "patched homespun wool cloaks, fur caps, woven shawls covered in snow",
        "weapon": "none",
        "signatureVfx": "blowing snowdrifts and cold breath mist",
        "voiceToneEn": "hushed, sorrowful silence",
        "continuityAnchor": "Village Refugees: huddled winter-cloaked frontier elders and families trudging through heavy snow",
    },
    "Narrator": {
        "canonicalName": "Narrator",
        "aliases": ["narrator", "offscreen narrator", "voiceover"],
        "role": "Off-screen dark-fantasy chronicler framing the opening and closing scenes",
        "hair": "off-screen",
        "eyesAndExpression": "off-screen",
        "armorAndOutfit": "off-screen",
        "weapon": "none",
        "signatureVfx": "none",
        "voiceToneEn": "deep, steady, grounded spoken off-screen male narrator; natural dry documentary gravity",
        "continuityAnchor": "Off-screen narrator only; all on-screen characters keep mouths completely closed",
    },
}

CANONICAL_PROPS: dict[str, dict[str, Any]] = {
    "Cracked Golden Holy Knight Seal": {
        "canonicalName": "Cracked Golden Holy Knight Seal",
        "aliases": ["seal", "golden seal", "holy knight seal", "insignia", "breastplate insignia", "crest"],
        "materialAndAppearance": "heavy antique tarnished-gold circular medallion/breastplate crest split by a jagged diagonal fracture, engraved with winged-shield Order runes",
        "glowAndVfx": "subtle pulsing warm-gold aura along the fracture line",
        "continuityAnchor": "cracked tarnished-gold Holy Knight seal etched with faint glowing runes",
    },
    "Twin Lightning Swords": {
        "canonicalName": "Twin Lightning Swords",
        "aliases": ["twin swords", "twin blades", "lightning swords", "lightning blades", "dual swords", "aleksandar's swords"],
        "materialAndAppearance": "paired slender northern sabers with dark-iron crossguards, leather-wrapped hilts, and runic fuller grooves down brushed steel blades",
        "glowAndVfx": "crackling electric cobalt-blue and white lightning arcs dancing along both blades",
        "continuityAnchor": "Aleksandar's twin runic steel blades wreathed in crackling cobalt-white lightning",
    },
    "Arcane Flame Spear": {
        "canonicalName": "Arcane Flame Spear",
        "aliases": ["spear", "arcane spear", "flame spear", "balian's spear", "spearhead"],
        "materialAndAppearance": "long ash-wood shaft bound in iron rings, topped with a broad leaf-shaped steel spearhead etched with ancient arcane channels",
        "glowAndVfx": "flickering azure-and-amber arcane fire wrapping the spearhead and casting heat shimmer in snow",
        "continuityAnchor": "Balian's iron-bound arcane spear blazing with azure-amber elemental flame",
    },
    "Silver Daggers": {
        "canonicalName": "Silver Daggers",
        "aliases": ["silver dagger", "silver daggers", "twin silver daggers", "dagger", "daggers", "doe-skin"],
        "materialAndAppearance": "two slender white-silver ceremonial daggers wrapped in oiled pale doe-skin, delicate frost-blue rune veins inlaid along each fuller",
        "glowAndVfx": "soft frost-blue bioluminescent rune pulse shining softly even in dark blizzard shadow",
        "continuityAnchor": "slender white-silver Holy Order daggers with faint frost-blue glowing runes",
    },
    "Golden Aegis Dome": {
        "canonicalName": "Golden Aegis Dome",
        "aliases": ["aegis", "golden aegis", "barrier", "dome", "shield dome"],
        "materialAndAppearance": "translucent hemispherical barrier of interlocking geometric golden light runes expanding from Hercul's open palms",
        "glowAndVfx": "warm radiant gold refraction deflecting wind and snow",
        "continuityAnchor": "translucent radiant golden rune-barrier dome emanating from Hercul's palms",
    },
    "Broken Sword-Sheath": {
        "canonicalName": "Broken Sword-Sheath",
        "aliases": ["sheath", "broken sheath", "sword-sheath", "scabbard"],
        "materialAndAppearance": "splintered dark-leather and iron-tipped scabbard of Aleksandar's sword, scorched and snow-dusted",
        "glowAndVfx": "cold rim light catching the torn iron chape against white snow",
        "continuityAnchor": "Aleksandar's splintered dark-leather and iron sword-sheath half-buried in snow",
    },
    "Golden Wheat Seeds": {
        "canonicalName": "Golden Wheat Seeds",
        "aliases": ["wheat", "wheat seeds", "seeds", "grain"],
        "materialAndAppearance": "a small handful of warm golden wheat grains cradled in Elwin's frost-reddened fingers",
        "glowAndVfx": "warm sunlit-gold highlight contrasting sharply against frozen slate soil and white snow",
        "continuityAnchor": "handful of warm golden wheat seeds pressed into frozen dark earth beneath snow",
    },
    "Suspension Bridge & Mooring Cables": {
        "canonicalName": "Suspension Bridge & Mooring Cables",
        "aliases": ["bridge", "suspension bridge", "mooring cables", "cables", "ropes"],
        "materialAndAppearance": "weathered timber plank suspension bridge spanning an icy mountain gorge, anchored by thick braided iron-and-hemp mooring cables crusted with frost",
        "glowAndVfx": "snapping tension sparks, flying wood splinters, swirling gorge mist",
        "continuityAnchor": "snow-covered wooden suspension bridge over an icy chasm with taut frost-crusted mooring cables",
    },
    "Holy Warhammer": {
        "canonicalName": "Holy Warhammer",
        "aliases": ["warhammer", "holy warhammer", "paladin hammer", "hercul's hammer"],
        "materialAndAppearance": "heavy dark-steel and tarnished-gold paladin warhammer etched with Order sigils along the flanged head",
        "glowAndVfx": "subtle warm golden rune glow along the hammer head",
        "continuityAnchor": "Hercul's heavy runic steel-and-gold Holy Knight warhammer",
    },
    "Broken Twin Sword Blade": {
        "canonicalName": "Broken Twin Sword Blade",
        "aliases": ["broken blade", "broken sword", "shattered blade", "aleksandar's blade", "serrated groove"],
        "materialAndAppearance": "jagged snapped half of Aleksandar's northern steel blade bearing a cruel serrated groove and tiny royal high-command stamp",
        "glowAndVfx": "cold frost sheen reflecting off the fractured steel edge",
        "continuityAnchor": "Aleksandar's snapped northern sword blade with jagged fracture and imperial mark",
    },
    "Colossal Iron Maul": {
        "canonicalName": "Colossal Iron Maul",
        "aliases": ["maul", "colossal maul", "grimli's maul", "blacksmith hammer"],
        "materialAndAppearance": "massive forged dark-iron dwarven blacksmith war-maul wrapped in riveted leather grip",
        "glowAndVfx": "bursts of amber impact sparks on collision",
        "continuityAnchor": "Grimli's colossal forged dark-iron dwarven maul",
    },
    "Heavy Crossbow & Silver Quarrels": {
        "canonicalName": "Heavy Crossbow & Silver Quarrels",
        "aliases": ["crossbow", "heavy crossbow", "quarrel", "quarrels", "bolt", "bolts"],
        "materialAndAppearance": "mechanized dark-steel frontier hunter crossbow loaded with gleaming silver-tipped bolts",
        "glowAndVfx": "sharp white-silver streak trailing fired bolts",
        "continuityAnchor": "Aila's heavy dark-steel crossbow with silver-tipped quarrels",
    },
    "Iron Tracker Staff": {
        "canonicalName": "Iron Tracker Staff",
        "aliases": ["iron staff", "tracker staff", "gawain's staff", "staff"],
        "materialAndAppearance": "tall slender dark-iron quarterstaff banded with worn grip leather and a polished steel ferrule",
        "glowAndVfx": "faint pale-blue vibration rings pulsing at the base on impact",
        "continuityAnchor": "Gawain's tall dark-iron tracker staff",
    },
    "Seven Silver Coins": {
        "canonicalName": "Seven Silver Coins",
        "aliases": ["silver coins", "coins", "shillings", "crown", "coin"],
        "materialAndAppearance": "gleaming minted silver frontier shillings spun rapidly across fingers",
        "glowAndVfx": "crisp metallic silver glints tracing midair arcs",
        "continuityAnchor": "Kaze's gleaming spinning silver shillings",
    },
    "Runic Canal Paddle": {
        "canonicalName": "Runic Canal Paddle",
        "aliases": ["paddle", "paddles", "oar", "runic paddle", "runic oar"],
        "materialAndAppearance": "heavy weathered hardwood boatman oar carved with recessed hydro-control runes",
        "glowAndVfx": "luminous cyan-blue rune glow pulling swirling canal water",
        "continuityAnchor": "Rondol's rune-carved hardwood canal oar glowing with cyan hydro-energy",
    },
    "Sun-Pepper Alchemical Vials": {
        "canonicalName": "Sun-Pepper Alchemical Vials",
        "aliases": ["vial", "vials", "sun-pepper", "sun-peppers", "herb-pouches", "satchel"],
        "materialAndAppearance": "small stoppered glass apothecary vials filled with bright amber-orange pulverized sun-pepper powder",
        "glowAndVfx": "dense glowing amber-gold vapor cloud billowing on shatter",
        "continuityAnchor": "Eliana's glass sun-pepper alchemical vials releasing bright amber vapor",
    },
    "Merchant Ledger with Wax Seal": {
        "canonicalName": "Merchant Ledger with Wax Seal",
        "aliases": ["ledger", "merchant ledger", "wax seal", "parchment"],
        "materialAndAppearance": "soot-edged leather-bound ledger open to weathered parchment stamped with a deep crimson serpentine wax seal",
        "glowAndVfx": "warm lantern light catching the crimson wax emblem",
        "continuityAnchor": "charred merchant ledger stamped with Prince Lucian's crimson wax seal",
    },
}

EPISODE_ACT_PALETTES: dict[int, dict[str, dict[str, Any]]] = {
    1: {
        "1": {
            "actNumber": 1,
            "actTitle": "Blizzard Oath",
            "paletteHex": ["#0D1826", "#2B4663", "#C8DCF0", "#D98A3C", "#F6D365"],
            "colorScheme": "Deep midnight-slate & icy blizzard blue exteriors contrasted with warm amber charcoal hearthlight and radiant golden aegis light inside the weathered log tavern",
            "lightingDirection": "Harsh cold rim-light from blowing snow gusts at doorways; low warm orange-gold key light from tavern hearth and glowing runes on oak table",
            "atmosphereAndWeather": "Howling heavy blizzard, layered diagonal snowflakes, frost mist, drifting hearth embers",
        },
        "2": {
            "actNumber": 2,
            "actTitle": "Dawn of Betrayal",
            "paletteHex": ["#1A161F", "#6B2020", "#E86A2C", "#4CC3FF", "#E2EEF8"],
            "colorScheme": "Pale steel-blue winter dawn violently torn by blazing crimson-orange village fire, thick charcoal smoke, electric cobalt-white lightning arcs, and azure-amber spear flames",
            "lightingDirection": "High-contrast dual-tone backlighting: inferno orange-red from burning thatch roofs opposing icy cyan-white dawn light over the snowy gorge and bridge",
            "atmosphereAndWeather": "Rising ember storms, billowing dark smoke clouds, swirling gorge snow squall, electric spark trails",
        },
        "3": {
            "actNumber": 3,
            "actTitle": "Vow Beneath the Snow",
            "paletteHex": ["#182230", "#4A5C70", "#D7E4F0", "#89D4FF", "#E5B95C"],
            "colorScheme": "Quiet, solemn overcast silver-blue tundra, distant charcoal smoke column against pale twilight sky, punctuated by subtle frost-blue dagger glow and warm golden wheat seeds",
            "lightingDirection": "Soft diffused overcast sky light with crisp silver-white snow bounce and intimate warm rim highlights on Elwin's face and hands",
            "atmosphereAndWeather": "Steady windswept snow flurries, swirling ground spindrift, fading distant smoke plume on the horizon",
        },
    },
    2: {
        "1": {
            "actNumber": 1,
            "actTitle": "Ashes of Elwin & Fog of Sevenbridge",
            "paletteHex": ["#141B24", "#364554", "#9FB3C8", "#C99A4E", "#E6EEF5"],
            "colorScheme": "Desolate ash-grey snow ruins of Elwin village transitioning into dense sea-fog slate blue and muted amber dock lanterns in Sevenbridge's fishmongers' alleys",
            "lightingDirection": "Cold overcast winter diffuse light over charred timber ruins; moody directional harbor lantern rim-light slicing through thick port fog",
            "atmosphereAndWeather": "Thin rising ash wisps over frozen ruins shifting to swirling damp sea mist and wet stone cobblestones",
        },
        "2": {
            "actNumber": 2,
            "actTitle": "Clash at Sevenbridge Docks",
            "paletteHex": ["#121A26", "#2E5B78", "#5AD0FF", "#E89B3C", "#F8DF7A"],
            "colorScheme": "High-contrast harbor combat palette: radiant golden aegis dome clashing with gleaming silver crossbow bolts, freezing teal canal water surges, and blazing amber sun-pepper vapor clouds",
            "lightingDirection": "Explosive golden-amber spell backlighting from Hercul's barrier and alchemical vapor contrasting against cool cyan harbor water reflections",
            "atmosphereAndWeather": "Shredded market awning debris, swirling icy water spray, pungent glowing amber dust clouds, drifting sea fog",
        },
        "3": {
            "actNumber": 3,
            "actTitle": "Oath of the Seven Pursuers",
            "paletteHex": ["#101824", "#2F4156", "#B8CDE0", "#8BD8FF", "#E5B85B"],
            "colorScheme": "Clearing misty harbor dusk illuminated by warm dockside lantern gold, pale frost-blue silver dagger gleam, and divergent horizons of northern blizzard white and southern court shadow",
            "lightingDirection": "Soft twilight rim-lighting on wet flagstones with warm golden key light on the sealed ledger and crisp silver highlights on clashing blade and iron staff",
            "atmosphereAndWeather": "Settling sea mist, gentle harbor breeze, distant northern snow clouds gathering on the horizon",
        },
    },
    3: {
        "1": {
            "actNumber": 1,
            "actTitle": "Shroud of Mistfall Cliff",
            "paletteHex": ["#0F161E", "#2C3B4A", "#8FA6B8", "#5AD4F5", "#B5C7D3"],
            "colorScheme": "Towering dark basalt monoliths swallowed by dense icy grey-blue chasm mist, punctuated by bright azure reagent powder hiss",
            "lightingDirection": "Diffused eerie zenith fog-light filtering through towering stone pillars with crisp cyan highlight from Eliana's reagent",
            "atmosphereAndWeather": "Thick rolling abyssal fog, falling loose shale pebbles, swirling cold mountain updrafts",
        },
        "2": {
            "actNumber": 2,
            "actTitle": "Ambush at the Titan Shrine",
            "paletteHex": ["#161022", "#4B2366", "#9E4BFF", "#47C6FF", "#F0A848"],
            "colorScheme": "Dark volcanic shrine columns lit by vivid violet-amethyst crystal flares, surging cyan water arcs, and sharp steel spark bursts",
            "lightingDirection": "High-contrast supernatural violet backlight from Belphegor's crystals and Gorgo's shadow wind clashing with cool cyan and amber combat sparks",
            "atmosphereAndWeather": "Inward-twisting dark mist vortex, flying crystal splinters, whip-like gale currents",
        },
        "3": {
            "actNumber": 3,
            "actTitle": "Breaking the Mist Vortex",
            "paletteHex": ["#141E2B", "#3B526B", "#C5D9EC", "#7CE0FF", "#E8C070"],
            "colorScheme": "Shattering amethyst fog giving way to crisp cold alpine twilight, pale silver cliff light, and warm glint of resolved steel",
            "lightingDirection": "Breaking cold mountain rim-light sweeping across the cliff edge as dark haze clears",
            "atmosphereAndWeather": "Dispersing mist ribbons, settling crystal dust, sharp northern mountain wind",
        },
    },
    4: {
        "1": {
            "actNumber": 1,
            "actTitle": "Winter Yurts of the Wildlands",
            "paletteHex": ["#131C28", "#3B526B", "#D9E7F2", "#D98236", "#F3C76A"],
            "colorScheme": "Vast pale-blue frozen permafrost steppe and white snowdrifts contrasted with warm smoky orange hearthlight inside nomad leather yurts",
            "lightingDirection": "Crisp cold arctic snow bounce outdoors; intimate warm firelight rim on Elwin and young Kadan indoors",
            "atmosphereAndWeather": "Howling arctic gales, drifting yurt hearth smoke, powdery blowing spindrift",
        },
        "2": {
            "actNumber": 2,
            "actTitle": "Trial in the Frozen Ravine",
            "paletteHex": ["#0E1824", "#264059", "#B7D0E8", "#74D4FF", "#D95338"],
            "colorScheme": "Glacial canyon steel-blue shadow slashed by blinding white snow squalls, frost-blue silver dagger gleam, and vivid crimson-gold nomad cloak accents",
            "lightingDirection": "Stark low-angle winter dawn backlighting carving crisp silhouettes through blowing snow",
            "atmosphereAndWeather": "Blinding ravine snowstorm, kicked-up ice spray, taut winter breath vapor",
        },
        "3": {
            "actNumber": 3,
            "actTitle": "Arrival of the Frontier Masters",
            "paletteHex": ["#1A2230", "#4A5A70", "#D5E2EE", "#E3A65B", "#9AD8FF"],
            "colorScheme": "Clearing pale-gold arctic dusk over the nomad camp, uniting warm sunset amber on snow plains with cool silver-blue resolve",
            "lightingDirection": "Long warm late-afternoon rim light across the snowfield highlighting Kadan and the arriving Pursuers",
            "atmosphereAndWeather": "Calming snow flurries, golden sunset haze over distant mountain ridges",
        },
    },
    5: {
        "1": {
            "actNumber": 1,
            "actTitle": "Tempest & the Titan Cavern",
            "paletteHex": ["#0E131D", "#253047", "#6E52A8", "#58B888", "#E09145"],
            "colorScheme": "Violent violet storm lightning illuminating dark basalt canyons outside, contrasted with luminous green cavern moss and flickering orange campfire inside",
            "lightingDirection": "Periodic stark violet lightning flashes from the cavern mouth opposing low warm firelight on wet limestone walls",
            "atmosphereAndWeather": "Sheet rain deluge outside, dripping stalactite condensation, rising campfire steam",
        },
        "2": {
            "actNumber": 2,
            "actTitle": "Phantom in the Downpour",
            "paletteHex": ["#0D0C18", "#3B1E5C", "#A44CFF", "#4AD4FF", "#CFE8FA"],
            "colorScheme": "Abyssal cavern darkness pierced by glowing inverted violet runes, streaking purple shadow afterimages, and crisp concentric cyan acoustic ripples",
            "lightingDirection": "Dramatic high-contrast rim light from violet sorcery and bright cyan sonic wave rings pulsing across wet stone",
            "atmosphereAndWeather": "Lashing diagonal rain streaks, vibrating suspended water droplets, swirling shadow vapor",
        },
        "3": {
            "actNumber": 3,
            "actTitle": "Awakening the Acoustic Sense",
            "paletteHex": ["#121E2C", "#2F4E6E", "#8AE2FF", "#E2F1FA", "#E5C16C"],
            "colorScheme": "Crystal-clear luminous cyan-white sonic perception burst shattering purple shadow mist, resolving into cool misty dawn light over the rain-washed canyon",
            "lightingDirection": "Clean radial cyan-white light pulse at climax transitioning to soft silver-blue post-storm morning light",
            "atmosphereAndWeather": "Softening rain mist, gleaming wet basalt stone, clearing storm clouds",
        },
    },
}

DEFAULT_ACT_PALETTES = EPISODE_ACT_PALETTES[1]

GLOBAL_STYLE_LOCK: dict[str, Any] = {
    "artDirection": "High-budget modern dark-fantasy cel-shaded 2D anime, crisp hand-inked lineart, rich painted backgrounds, dramatic volumetric rim lighting, 2.5D kinetic camera sweeps, 24fps sakuga animation fluidity",
    "aspectRatio": "16:9",
    "resolution": "1280x720",
    "frameRate": 24,
    "strictNegativeRules": [
        "ZERO on-screen text, subtitles, captions, speech bubbles, letters, numbers, or watermarks",
        "NEVER reference copyrighted studio or anime brand names",
        "Preserve exact start-frame character silhouettes, hair, outfits, and props across every cut",
        "Use Veo-safe cinematic fantasy phrasing (no graphic gore or prohibited violence terms)",
    ],
}


def resolve_path(raw_path: str) -> Path:
    p = Path(raw_path)
    if p.is_absolute():
        return p
    return (REPO_ROOT / p).resolve()


def match_canonical_character(name: str) -> dict[str, Any]:
    low = name.strip().lower()
    for profile in CANONICAL_CHARACTERS.values():
        if low == profile["canonicalName"].lower():
            return profile
        for alias in profile.get("aliases", []):
            if alias in low or low in alias:
                return profile
    # Fallback structured profile for any character not in EP01 canonical map
    clean_name = name.strip()
    return {
        "canonicalName": clean_name,
        "aliases": [low],
        "role": "Supporting character appearing in storyboard",
        "hair": "match attached start-frame keyframe exactly",
        "eyesAndExpression": "expressive anime eyes matching scene emotion",
        "armorAndOutfit": "match attached start-frame keyframe winter dark-fantasy attire exactly",
        "weapon": "match attached start-frame keyframe",
        "signatureVfx": "subtle environmental snow/ember rim light",
        "voiceToneEn": "natural expressive English anime voice matching character age and role",
        "continuityAnchor": f"{clean_name}: preserve exact appearance, hair, and outfit from attached start-frame keyframe",
    }


def match_canonical_prop(prop_name: str) -> dict[str, Any]:
    low = prop_name.strip().lower()
    for profile in CANONICAL_PROPS.values():
        if low == profile["canonicalName"].lower():
            return profile
        for alias in profile.get("aliases", []):
            if alias in low or low in alias:
                return profile
    clean_prop = sanitize_veo_text(prop_name.strip())
    return {
        "canonicalName": clean_prop,
        "aliases": [low],
        "materialAndAppearance": "match attached start-frame keyframe design and scale exactly",
        "glowAndVfx": "subtle cinematic rim highlight",
        "continuityAnchor": f"{clean_prop}: preserve exact shape and placement from start-frame keyframe",
    }


def upscale_keyframe(
    source_path: Path,
    dest_path: Path,
    width: int = 1280,
    height: int = 720,
) -> tuple[tuple[int, int], int]:
    """Load WebP/image, upscale cleanly via LANCZOS + subtle UnsharpMask, save PNG."""
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    resampling = getattr(Image, "Resampling", Image).LANCZOS

    with Image.open(source_path) as img:
        rgb = img.convert("RGB")
        upscaled = rgb.resize((width, height), resample=resampling)
        sharpened = upscaled.filter(
            ImageFilter.UnsharpMask(radius=1.2, percent=95, threshold=3)
        )
        sharpened.save(dest_path, format="PNG", optimize=True)

    with Image.open(dest_path) as check_img:
        out_size = check_img.size
    byte_size = dest_path.stat().st_size
    return out_size, byte_size


def build_continuity_bible(
    storyboard: dict[str, Any],
    keyframes_rel_dir: str,
) -> dict[str, Any]:
    ep_num = int(storyboard.get("episodeNumber", 1))
    cuts = storyboard.get("cuts", [])
    act_palettes = EPISODE_ACT_PALETTES.get(ep_num, DEFAULT_ACT_PALETTES)

    characters_map: dict[str, dict[str, Any]] = {}
    props_map: dict[str, dict[str, Any]] = {}
    cut_continuity_map: dict[str, dict[str, Any]] = {}

    # Seed episode-specific core recurring props so prompter always has them on hand
    core_prop_keys_by_ep: dict[int, list[str]] = {
        1: [
            "Cracked Golden Holy Knight Seal",
            "Twin Lightning Swords",
            "Arcane Flame Spear",
            "Silver Daggers",
        ],
        2: [
            "Holy Warhammer",
            "Broken Twin Sword Blade",
            "Golden Aegis Dome",
            "Silver Daggers",
            "Merchant Ledger with Wax Seal",
        ],
    }
    for key in core_prop_keys_by_ep.get(ep_num, []):
        p = dict(CANONICAL_PROPS[key])
        p.pop("aliases", None)
        p["appearingCuts"] = []
        props_map[p["canonicalName"]] = p

    for cut in cuts:
        cut_code = str(cut["cutCode"])
        act_num = int(cut.get("act", 1))
        act_key = str(act_num) if str(act_num) in act_palettes else "1"

        matched_char_names: list[str] = []
        raw_chars = list(cut.get("characters") or [])
        speaker = (cut.get("speakerEn") or "").strip()
        if speaker and speaker.lower() not in ("none", "n/a", ""):
            raw_chars.append(speaker)

        for raw_c in raw_chars:
            if not raw_c or str(raw_c).strip().lower() in ("none", "n/a"):
                continue
            prof = match_canonical_character(str(raw_c))
            cname = prof["canonicalName"]
            if cname not in characters_map:
                entry = dict(prof)
                entry.pop("aliases", None)
                entry["appearingCuts"] = []
                characters_map[cname] = entry
            if cut_code not in characters_map[cname]["appearingCuts"]:
                characters_map[cname]["appearingCuts"].append(cut_code)
            if cname not in matched_char_names:
                matched_char_names.append(cname)

        matched_prop_names: list[str] = []
        for raw_p in cut.get("props") or []:
            if not raw_p or str(raw_p).strip().lower() in ("none", "n/a"):
                continue
            prof = match_canonical_prop(str(raw_p))
            pname = prof["canonicalName"]
            if pname not in props_map:
                entry = dict(prof)
                entry.pop("aliases", None)
                entry["appearingCuts"] = []
                props_map[pname] = entry
            if cut_code not in props_map[pname]["appearingCuts"]:
                props_map[pname]["appearingCuts"].append(cut_code)
            if pname not in matched_prop_names:
                matched_prop_names.append(pname)

        palette = act_palettes[act_key]
        cut_continuity_map[cut_code] = {
            "cutNumber": cut.get("cutNumber"),
            "act": act_num,
            "actTitle": palette["actTitle"],
            "keyframePath": f"{keyframes_rel_dir}/{cut_code}_keyframe.png",
            "location": sanitize_veo_text(str(cut.get("location", ""))),
            "matchedCharacters": matched_char_names,
            "matchedProps": matched_prop_names,
            "lightingNote": palette["lightingDirection"],
            "colorScheme": palette["colorScheme"],
        }

    return {
        "episodeNumber": ep_num,
        "episodeTitleEn": storyboard.get("episodeTitleEn", f"Episode {ep_num}"),
        "totalCuts": len(cuts),
        "globalStyleLock": GLOBAL_STYLE_LOCK,
        "actPalettes": act_palettes,
        "characters": characters_map,
        "recurringProps": props_map,
        "cutContinuityMap": cut_continuity_map,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Upscale storyboard webtoon frames to 1280x720 PNG keyframes and build continuity bible."
    )
    parser.add_argument("--ep", type=int, required=True, help="Episode number (e.g. 1)")
    parser.add_argument(
        "--storyboard",
        type=str,
        default=None,
        help="Optional path to storyboard JSON (defaults to output/studio_anime/ep{N:02d}_en/storyboard_ep{N:02d}_en.json)",
    )
    parser.add_argument("--width", type=int, default=1280, help="Target keyframe width")
    parser.add_argument("--height", type=int, default=720, help="Target keyframe height")
    parser.add_argument(
        "--min-bytes",
        type=int,
        default=51200,
        help="Minimum expected PNG file size in bytes (default 50KB = 51200)",
    )
    args = parser.parse_args()

    ep_tag = f"ep{args.ep:02d}"
    ep_dir = REPO_ROOT / "output" / "studio_anime" / f"{ep_tag}_en"
    storyboard_path = (
        resolve_path(args.storyboard)
        if args.storyboard
        else ep_dir / f"storyboard_{ep_tag}_en.json"
    )

    if not storyboard_path.exists():
        print(f"[ERROR] Storyboard not found: {storyboard_path}", file=sys.stderr)
        return 1

    with storyboard_path.open("r", encoding="utf-8") as f:
        storyboard = json.load(f)

    cuts = storyboard.get("cuts", [])
    if not cuts:
        print(f"[ERROR] Storyboard contains no cuts: {storyboard_path}", file=sys.stderr)
        return 1

    keyframes_dir = ep_dir / "keyframes"
    keyframes_dir.mkdir(parents=True, exist_ok=True)
    keyframes_rel_dir = f"output/studio_anime/{ep_tag}_en/keyframes"

    errors: list[str] = []
    processed = 0
    min_size_seen = sys.maxsize
    max_size_seen = 0

    for cut in cuts:
        cut_code = str(cut["cutCode"])
        src_raw = cut.get("sourceWebtoonFile")
        if not src_raw:
            errors.append(f"{cut_code}: missing sourceWebtoonFile")
            continue

        src_path = resolve_path(src_raw)
        if not src_path.exists():
            errors.append(f"{cut_code}: source file does not exist: {src_path}")
            continue

        dest_path = keyframes_dir / f"{cut_code}_keyframe.png"
        out_size, byte_size = upscale_keyframe(
            src_path, dest_path, width=args.width, height=args.height
        )
        processed += 1
        min_size_seen = min(min_size_seen, byte_size)
        max_size_seen = max(max_size_seen, byte_size)

        if out_size != (args.width, args.height):
            errors.append(
                f"{cut_code}: expected {args.width}x{args.height}, got {out_size[0]}x{out_size[1]}"
            )
        if byte_size <= args.min_bytes:
            errors.append(
                f"{cut_code}: PNG size {byte_size} bytes <= threshold {args.min_bytes} bytes"
            )

        print(
            f"[OK] {cut_code} <- {src_raw} -> {dest_path.name} "
            f"({out_size[0]}x{out_size[1]}, {byte_size / 1024:.1f} KB)"
        )

    bible = build_continuity_bible(storyboard, keyframes_rel_dir)
    bible_path = ep_dir / f"continuity_bible_{ep_tag}.json"
    bible_path.parent.mkdir(parents=True, exist_ok=True)
    with bible_path.open("w", encoding="utf-8") as f:
        json.dump(bible, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(
        f"\n[SUMMARY] Processed {processed}/{len(cuts)} keyframes "
        f"(size range: {min_size_seen / 1024:.1f} KB - {max_size_seen / 1024:.1f} KB)"
    )
    print(
        f"[SUMMARY] Continuity bible written to {bible_path.relative_to(REPO_ROOT)} "
        f"({len(bible['characters'])} characters, {len(bible['recurringProps'])} props, "
        f"{len(bible['actPalettes'])} acts)"
    )

    if errors:
        print("\n[FAIL] Verification errors:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
