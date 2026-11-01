import json

with open(r"c:\Users\ARUL XAVIER\OneDrive - gapanchor\dashboard\scratch\all_80_frames_analysis.json") as f:
    data = json.load(f)

print("=" * 80)
print(f"{'FRAME RANGE':<16} | {'PILL':<10} | {'ASPECT':<8} | {'SHAPE DESCRIPTION':<35} | {'TEXT / DUST'}")
print("=" * 80)

segments = []
start_frame = data[0]['frame']
cur_pill = data[0]['pill']
cur_shape = data[0]['shape']

for idx, d in enumerate(data):
    is_last = (idx == len(data) - 1)
    if d['pill'] != cur_pill or d['shape'] != cur_shape or is_last:
        end_frame = d['frame'] if is_last and (d['pill'] == cur_pill and d['shape'] == cur_shape) else data[idx - 1]['frame']
        avg_aspect = sum(item['aspect_ratio'] for item in data[start_frame-1:end_frame]) / max(1, (end_frame - start_frame + 1))
        dust_info = f"Dust: {data[start_frame-1]['dust_activity']}->{data[end_frame-1]['dust_activity']}, Text: {data[end_frame-1]['text_activity']}"
        print(f"Frames {start_frame:03d} - {end_frame:03d}   | {cur_pill:<10} | {avg_aspect:<8.2f} | {cur_shape:<35} | {dust_info}")
        start_frame = d['frame']
        cur_pill = d['pill']
        cur_shape = d['shape']

print("=" * 80)
