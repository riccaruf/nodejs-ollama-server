from ultralytics import YOLO

def main():
    model = YOLO("yolo12n.yaml")

    #results = model.train(data="./Food-Detection/dataset/yolo.yaml", epochs=50, pretrained=True, iou=0.5, visualize=True, patience=0)
    model.train(data="./Food-Detection/dataset/yolo.yaml", epochs=200, pretrained=True, iou=0.5, visualize=True, patience=0)
    results = model.val()
    
if __name__ == "__main__":
    main()