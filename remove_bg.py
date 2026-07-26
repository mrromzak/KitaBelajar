from PIL import Image
import numpy as np
from collections import deque
import os
import glob

def flood_fill_transparent(path, out_path, tol=40):
    img = Image.open(path).convert("RGBA")
    arr = np.array(img)
    h, w = arr.shape[:2]
    visited = np.zeros((h, w), dtype=bool)

    corner_color = arr[0, 0, :3].astype(int)

    q = deque()
    for x in range(w):
        for y in [0, h - 1]:
            if not visited[y, x]:
                q.append((y, x))
    for y in range(h):
        for x in [0, w - 1]:
            if not visited[y, x]:
                q.append((y, x))

    def close_enough(y, x):
        px = arr[y, x, :3].astype(int)
        return np.abs(px - corner_color).sum() <= tol

    while q:
        y, x = q.popleft()
        if visited[y, x]:
            continue
        if not close_enough(y, x):
            continue
        visited[y, x] = True
        arr[y, x, 3] = 0
        if y > 0: q.append((y - 1, x))
        if y < h - 1: q.append((y + 1, x))
        if x > 0: q.append((y, x - 1))
        if x < w - 1: q.append((y, x + 1))

    Image.fromarray(arr, "RGBA").save(out_path)
    print(f"OK: {os.path.basename(path)} (corner_color={corner_color}, transparent_px={visited.sum()})")

FOLDER = "frontend/public/assets/badge"
BACKUP = "frontend/public/assets/badge_backup_original"

os.makedirs(BACKUP, exist_ok=True)

for filepath in glob.glob(os.path.join(FOLDER, "*.png")):
    filename = os.path.basename(filepath)
    backup_path = os.path.join(BACKUP, filename)
    if not os.path.exists(backup_path):
        Image.open(filepath).save(backup_path)
    try:
        flood_fill_transparent(filepath, filepath, tol=40)
    except Exception as e:
        print(f"GAGAL: {filename} — {e}")

print("Selesai. File asli ada backup-nya di folder badge_backup_original/ kalau perlu di-restore.")
