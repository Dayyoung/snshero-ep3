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
        "voiceToneEn": "deep, steady, gravelly baritone; restrained northern stoicism breaking into fierce protective thunder in combat",
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
        "voiceToneEn": "rough, seasoned, resonant veteran baritone; gruff warmth with allies and roaring conviction in sacrifice",
        "continuityAnchor": "Balian: broad-shouldered bearded veteran in scarred iron-bronze armor and rust-brown winter mantle wielding an arcane flame spear",
    },
    "Hercul": {
        "canonicalName": "Hercul",
        "aliases": ["hercul", "hercules"],
        "role": "Wandering surviving Holy Knight messenger exposing the Shadow Realm conspiracy",
        "hair": "tousled silver-streaked ash-brown hair partially shadowed beneath a tattered hood",
        "eyesAndExpression": "weary, solemn gold-flecked eyes carrying ancient sorrow and quiet radiance",
        "armorAndOutfit": "tattered ivory-and-slate pilgrim cloak over cracked Holy Knight surcoat, torn iron gauntlets leaking faint golden runes",
        "weapon": "unarmed defensive golden mana aegis; carries the cracked golden Holy Knight seal and twin silver daggers",
        "signatureVfx": "warm translucent golden rune-barrier dome and floating incandescent motes",
        "voiceToneEn": "solemn, weathered, resonant elder tenor-baritone; calm prophetic gravity",
        "continuityAnchor": "Hercul: hooded wandering Holy Knight in tattered pilgrim vestments, cracked golden belt seal, faint golden mana leaking from torn gauntlets",
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
        "voiceToneEn": "warm, clear, heartfelt mezzo-soprano; trembling with grief yet ringing steady and unbroken against the wind",
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
        "voiceToneEn": "sharp, passionate, defiant alto-mezzo; fierce cry cutting through chaos",
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
        "voiceToneEn": "silky, aristocratic, venomous mid-tenor; mocking condescension and icy menace",
        "continuityAnchor": "Lucian: pale blond aristocratic courtier in crimson-black ermine-trimmed noble cloak with gilded serpentine crest",
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
        "role": "Off-screen dark-fantasy chronicler framing the opening and closing vows",
        "hair": "off-screen",
        "eyesAndExpression": "off-screen",
        "armorAndOutfit": "off-screen",
        "weapon": "none",
        "signatureVfx": "none",
        "voiceToneEn": "deep, resonant, cinematic off-screen male narrator with solemn mythic cadence",
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
}

ACT_PALETTES: dict[str, dict[str, Any]] = {
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
}

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

    characters_map: dict[str, dict[str, Any]] = {}
    props_map: dict[str, dict[str, Any]] = {}
    cut_continuity_map: dict[str, dict[str, Any]] = {}

    # Seed the 4 core recurring props for EP01 so prompter always has them on hand
    core_prop_keys = [
        "Cracked Golden Holy Knight Seal",
        "Twin Lightning Swords",
        "Arcane Flame Spear",
        "Silver Daggers",
    ]
    for key in core_prop_keys:
        p = dict(CANONICAL_PROPS[key])
        p.pop("aliases", None)
        p["appearingCuts"] = []
        props_map[p["canonicalName"]] = p

    for cut in cuts:
        cut_code = str(cut["cutCode"])
        act_num = int(cut.get("act", 1))
        act_key = str(act_num) if str(act_num) in ACT_PALETTES else "1"

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

        palette = ACT_PALETTES[act_key]
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
        "actPalettes": ACT_PALETTES,
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
