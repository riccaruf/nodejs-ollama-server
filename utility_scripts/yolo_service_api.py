from fastapi import FastAPI, UploadFile, File, Query
from fastapi.responses import FileResponse, JSONResponse
import shutil
import uuid
import os
import subprocess
import uvicorn

app = FastAPI()
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

@app.post("/annotate")
async def annotate_image(
    image: UploadFile = File(...),
    model: str = Query(...),
    conf: float = Query(0.4),
    line_thickness: int = Query(1)
):
    temp_id = str(uuid.uuid4())
    input_dir = f"temp/input_{temp_id}"
    output_dir = f"temp/runs_{temp_id}"

    os.makedirs(input_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)

    input_image_path = os.path.join(input_dir, image.filename)
    with open(input_image_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)

    command = [
        "yolo", "task=detect", "mode=predict",
        f"model={model}",
        f"source={input_image_path}",
        f"project={output_dir}",
        "name=annotated",
        f"conf={conf}",
        f"line_thickness={line_thickness}"
    ]

    #result = subprocess.run(command, capture_output=True, text=True)
    result = subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        errors='ignore'  # <-- ignora caratteri non decodificabili
    )

    if result.returncode != 0:
        return JSONResponse(
            status_code=500,
            content={"error": "YOLO failed", "details": result.stderr}
        )

    output_image_folder = os.path.join(output_dir, "annotated")
    predicted_files = [f for f in os.listdir(output_image_folder) if f.endswith(".jpg") or f.endswith(".png")]
    if not predicted_files:
        return JSONResponse(
            status_code=500,
            content={"error": "No output image found"}
        )

    predicted_image_path = os.path.join(output_image_folder, predicted_files[0])
    return FileResponse(predicted_image_path, media_type="image/jpeg")


# ✅ Blocco main per l'avvio diretto
if __name__ == "__main__":
    uvicorn.run("yolo_service_api:app", host="0.0.0.0", port=8000, reload=True)
