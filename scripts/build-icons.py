from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
CANDIDATES = [
    ROOT / "tonkatsu-translate PNG.png",
    ROOT / "branding" / "tonkatsu-source.png",
]
BRAND = ROOT / "branding"
PUBLIC = ROOT / "apps" / "extension" / "public"


def find_source() -> Path:
    for path in CANDIDATES:
        if path.exists():
            return path
    raise FileNotFoundError("No brand source image found")


def main() -> None:
    BRAND.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)

    src = find_source()
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    im = im.crop((left, top, left + side, top + side))

    # Keep a clean archival source (no badge)
    source_out = BRAND / "tonkatsu-source.png"
    im.save(source_out, format="PNG")

    draw = ImageDraw.Draw(im)
    s = im.width
    badge = int(s * 0.30)
    pad = int(s * 0.05)
    bx1 = s - badge - pad
    by1 = s - badge - pad
    bx2 = s - pad
    by2 = s - pad
    radius = max(8, badge // 4)

    # Soft dark badge that reads on black + pink art
    draw.rounded_rectangle((bx1, by1, bx2, by2), radius=radius, fill=(255, 250, 242, 235))
    draw.rounded_rectangle(
        (bx1, by1, bx2, by2),
        radius=radius,
        outline=(31, 26, 20, 255),
        width=max(2, badge // 18),
    )

    try:
        font = ImageFont.truetype("arialbd.ttf", int(badge * 0.72))
    except OSError:
        font = ImageFont.load_default()

    text = "T"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = bx1 + (badge - tw) / 2 - bbox[0]
    ty = by1 + (badge - th) / 2 - bbox[1] - int(badge * 0.05)
    draw.text((tx, ty), text, font=font, fill=(196, 92, 38, 255))

    master = BRAND / "tonkatsu-mark.png"
    im.save(master, format="PNG")
    im.resize((512, 512), Image.Resampling.LANCZOS).save(
        BRAND / "tonkatsu-mark-512.png", format="PNG"
    )

    for size in (16, 32, 48, 128):
        im.resize((size, size), Image.Resampling.LANCZOS).save(
            PUBLIC / f"icon-{size}.png", format="PNG"
        )
        print(f"wrote icon-{size}.png")

    print(f"source {source_out}")
    print(f"master {master}")


if __name__ == "__main__":
    main()
