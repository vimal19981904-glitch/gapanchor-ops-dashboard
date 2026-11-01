import os
import json
from PIL import Image

frames_dir = r"c:\Users\ARUL XAVIER\OneDrive - gapanchor\dashboard\jarvis-frames"

results = []

for frame_idx in range(1, 81):
    filename = f"ezgif-frame-{frame_idx:03d}.jpg"
    path = os.path.join(frames_dir, filename)
    if not os.path.exists(path):
        continue

    img = Image.open(path).convert("RGB")
    w, h = img.size

    # 1. Detect active pill at top (y: 160-200, x: 200-450)
    # LISTENING is left, THINKING is middle, SPEAKING is right
    listening_crop = img.crop((w * 0.22, h * 0.16, w * 0.42, h * 0.20))
    thinking_crop = img.crop((w * 0.42, h * 0.16, w * 0.60, h * 0.20))
    speaking_crop = img.crop((w * 0.60, h * 0.16, w * 0.78, h * 0.20))

    def avg_brightness(crop):
        pixels = list(crop.getdata())
        return sum(p[0] + p[1] + p[2] for p in pixels) / (len(pixels) * 3)

    b_list = avg_brightness(listening_crop)
    b_think = avg_brightness(thinking_crop)
    b_speak = avg_brightness(speaking_crop)

    if b_speak > b_list and b_speak > b_think:
        pill = "SPEAKING"
    elif b_think > b_list and b_think > b_speak:
        pill = "THINKING"
    else:
        pill = "LISTENING"

    # 2. Particle sphere region (y: 0.19 to 0.55)
    sphere_crop = img.crop((0, int(h * 0.19), w, int(h * 0.55)))
    sw, sh = sphere_crop.size
    sphere_pixels = list(sphere_crop.getdata())
    
    # Threshold for particle dot (> 30 brightness)
    active_pts = []
    r_sum, g_sum, b_sum = 0, 0, 0
    for idx, (r, g, b) in enumerate(sphere_pixels):
        bright = (r + g + b) / 3.0
        if bright > 35:
            px = idx % sw
            py = idx // sw
            active_pts.append((px, py))
            r_sum += r
            g_sum += g
            b_sum += b

    particle_count_estimate = len(active_pts)
    if active_pts:
        xs = [p[0] for p in active_pts]
        ys = [p[1] for p in active_pts]
        box_w = max(xs) - min(xs)
        box_h = max(ys) - min(ys)
        aspect = box_w / max(1, box_h)
        centroid_y = sum(ys) / len(ys)
        avg_r = r_sum / len(active_pts)
        avg_g = g_sum / len(active_pts)
        avg_b = b_sum / len(active_pts)
    else:
        box_w, box_h, aspect = 0, 0, 1.0
        centroid_y = 0
        avg_r, avg_g, avg_b = 0, 0, 0

    # 3. Dust region between sphere and text (y: 0.52 to 0.62)
    dust_crop = img.crop((0, int(h * 0.52), w, int(h * 0.62)))
    dust_active = sum(1 for (r, g, b) in dust_crop.getdata() if (r + g + b) / 3.0 > 40)

    # 4. Text region (y: 0.60 to 0.72)
    text_crop = img.crop((0, int(h * 0.60), w, int(h * 0.72)))
    text_active = sum(1 for (r, g, b) in text_crop.getdata() if (r + g + b) / 3.0 > 45)

    # Classify visual shape
    if pill == "LISTENING":
        shape = "Hollow Spherical Shell (Breathing/Jiggling)"
    elif pill == "THINKING":
        if aspect > 1.35 and box_h < 180:
            shape = "Flattened 4-Slice Horizontal Slabs (Squash Phase)"
        else:
            shape = "Twisted 3D Lissajous Ribbon Loop (Spinning)"
    else: # SPEAKING
        if dust_active > 150:
            shape = "Dense Pulsing Sphere Shedding Dust to Glyphs"
        else:
            shape = "Recombined Dense Sphere"

    results.append({
        "frame": frame_idx,
        "filename": filename,
        "pill": pill,
        "shape": shape,
        "particle_density": particle_count_estimate,
        "box_width": box_w,
        "box_height": box_h,
        "aspect_ratio": round(aspect, 2),
        "dust_activity": dust_active,
        "text_activity": text_active,
        "color_rgb": [round(avg_r, 1), round(avg_g, 1), round(avg_b, 1)]
    })

output_path = r"c:\Users\ARUL XAVIER\OneDrive - gapanchor\dashboard\scratch\all_80_frames_analysis.json"
with open(output_path, "w") as f:
    json.dump(results, f, indent=2)

print(f"Successfully analyzed {len(results)} frames. Saved to {output_path}")
