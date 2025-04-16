import os
import cv2
import albumentations as A
import random
from glob import glob

# Mappa delle classi per debug (puoi personalizzarla)
class_names = {
    0: "Apple", 1: "Chapathi", 2: "Chicken Gravy", 3: "Fries",
    4: "Idli", 5: "Pizza", 6: "Rice", 7: "Soda", 8: "Vada",
    9: "banana", 10: "burger", 11: "pasta-pomodoro"
}

# Augmentazioni da applicare
transform = A.Compose([
    A.HorizontalFlip(p=0.5),
    A.RandomBrightnessContrast(p=0.5),
    A.Rotate(limit=30, p=0.5),
], bbox_params=A.BboxParams(format='yolo', label_fields=['class_labels']))

def augment_yolo_image(img_path, label_path, output_img_dir, output_lbl_dir, num_aug=3):
    image = cv2.imread(img_path)
    h, w = image.shape[:2]

    # Legge le label YOLO
    with open(label_path, 'r') as f:
        labels = f.readlines()

    bboxes = []
    class_labels = []

    for line in labels:
        parts = line.strip().split()
        if len(parts) != 5:
            print(f"[!] RIGA SCARTATA in {label_path}: {line.strip()}")
            continue
        cls, x, y, bw, bh = map(float, parts)
        bboxes.append([x, y, bw, bh])
        class_labels.append(int(cls))

    base_name = os.path.splitext(os.path.basename(img_path))[0]

    for i in range(num_aug):
        transformed = transform(image=image, bboxes=bboxes, class_labels=class_labels)

        new_img = transformed['image']
        new_bboxes = transformed['bboxes']
        new_labels = transformed['class_labels']

        img_out_path = os.path.join(output_img_dir, f"{base_name}_aug{i}.jpg")
        lbl_out_path = os.path.join(output_lbl_dir, f"{base_name}_aug{i}.txt")

        cv2.imwrite(img_out_path, new_img)

        with open(lbl_out_path, 'w') as out_f:
            for bbox, label in zip(new_bboxes, new_labels):
                out_f.write(f"{label} {' '.join(map(str, bbox))}\n")

        print(f"[✓] Salvato: {img_out_path} con label {lbl_out_path}")

# 🚀 ENTRY POINT
def main():
    input_img_dir = "Food-detection/dataset/images/train"
    input_lbl_dir = "Food-detection/dataset/labels/train"
    output_img_dir = "Food-detection/dataset/images/train_aug"
    output_lbl_dir = "Food-detection/dataset/labels/train_aug"

    os.makedirs(output_img_dir, exist_ok=True)
    os.makedirs(output_lbl_dir, exist_ok=True)

    image_paths = glob(os.path.join(input_img_dir, "*.jpg"))

    for img_path in image_paths:
        label_path = os.path.join(input_lbl_dir, os.path.splitext(os.path.basename(img_path))[0] + ".txt")
        if os.path.exists(label_path):
            augment_yolo_image(img_path, label_path, output_img_dir, output_lbl_dir, num_aug=3)

if __name__ == "__main__":
    main()
