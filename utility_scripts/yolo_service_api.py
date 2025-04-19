from fastapi import FastAPI, UploadFile, File, Query
from fastapi.responses import FileResponse, JSONResponse
import shutil
import uuid
import os
import subprocess
import uvicorn
import zipfile

app = FastAPI()
import sys

sys.stdout.reconfigure(encoding='utf-8')

def delete_folder_recursive(folder_path):
    if os.path.exists(folder_path):
        # Itera sui contenuti della cartella
        for item in os.listdir(folder_path):
            item_path = os.path.join(folder_path, item)
            if os.path.isdir(item_path):
                # Se è una cartella, chiamalo ricorsivamente
                delete_folder_recursive(item_path)
            else:
                # Se è un file, cancellalo
                os.remove(item_path)
        # Una volta che tutti i file e cartelle sono stati rimossi, rimuovi la cartella vuota
        os.rmdir(folder_path)


@app.post("/annotate")
async def annotate_image(
    image: UploadFile = File(...),
    model: str = Query(...),
    conf: float = Query(0.4),
    line_thickness: int = Query(1)
):
    try:
        temp_id = str(uuid.uuid4())
        input_dir = f"temp/input_{temp_id}"
        output_dir = f"temp/runs_{temp_id}"
        

        os.makedirs(input_dir, exist_ok=True)
        os.makedirs(output_dir, exist_ok=True)
    
        input_image_path = os.path.join(input_dir, image.filename)
        with open(input_image_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        
        f"exist_ok=True"
        command = [
            "yolo", "task=detect", "mode=predict",
            f"model={model}",
            f"source={input_image_path}",
            f"project={output_dir}",
            "name=annotated",
            f"conf={conf}",
            f"line_thickness={line_thickness}",
            "exist_ok=True",
            "save_txt=True"# <-- aggiunto
        ]
        
        print(f"- Comando YOLO: {' '.join(command)}")
        result = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            errors='ignore'
        )

        if result.returncode != 0:
            return JSONResponse(
                status_code=500,
                content={"error": "YOLO failed", "details": result.stderr}
            )

        output_image_folder = os.path.join(output_dir, "annotated")
        predicted_files = [f for f in os.listdir(output_image_folder) if f.endswith(".jpg") or f.endswith(".png")]
        label_files = [f for f in os.listdir(os.path.join(output_image_folder, "labels")) if f.endswith(".txt")]

        if not predicted_files:
            return JSONResponse(
                status_code=500,
                content={"error": "No output image found"}
            )
        
        predicted_image_path = os.path.join(output_image_folder, predicted_files[0])

        # Se troviamo il file di label associato, lo includiamo
        label_path = None
        if label_files:
            label_path = os.path.join(output_image_folder, "labels", label_files[0])
        
        # Crea ZIP contenente immagine + label
        zip_path = os.path.join(output_image_folder, "prediction_output.zip")
        with zipfile.ZipFile(zip_path, "w") as zipf:
            zipf.write(predicted_image_path, arcname=os.path.basename(predicted_image_path))
            if label_path:
                zipf.write(label_path, arcname=os.path.basename(label_path))

        return FileResponse(zip_path, media_type="application/zip")
    except Exception as e:
        print(f"Errore durante l'esecuzione del comando: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": "Unexpected error", "details": str(e)}
        )
    finally:
        # codice che viene sempre eseguito
        #delete_folder_recursive("temp")
        print("- delete...")

# ✅ Blocco main per avvio diretto
if __name__ == "__main__":
    uvicorn.run("yolo_service_api:app", host="0.0.0.0", port=8000, reload=True)
    
