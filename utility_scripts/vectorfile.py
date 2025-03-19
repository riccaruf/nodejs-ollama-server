import os
import psycopg2
import numpy as np
import pdfplumber
from docx import Document
from sentence_transformers import SentenceTransformer
from langchain.text_splitter import RecursiveCharacterTextSplitter

# Configurazione del database PostgreSQL
DB_NAME = "postgres"
DB_USER = "postgres"
DB_PASSWORD = "mysecret"
DB_HOST = "localhost"
DB_PORT = "5432"

# Configurazione del modello di embedding
MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIM = 384  # Dipende dal modello usato

# Connetti al database PostgreSQL
conn = psycopg2.connect(
    dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD, host=DB_HOST, port=DB_PORT
)
cur = conn.cursor()

# Creazione della tabella per gli embedding
cur.execute(f"""
    CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        filename TEXT,
        content TEXT,
        embedding VECTOR({EMBEDDING_DIM})
    );
""")
conn.commit()

# Carica il modello di embedding
model = SentenceTransformer(MODEL_NAME)

# Funzione per estrarre testo dai PDF
def extract_text_from_pdf(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        return "\n".join([page.extract_text() for page in pdf.pages if page.extract_text()])

# Funzione per estrarre testo dai DOCX
def extract_text_from_docx(docx_path):
    doc = Document(docx_path)
    return "\n".join([p.text for p in doc.paragraphs])

# Funzione per spezzare il testo in chunk
def split_text(text, chunk_size=512, overlap=50):
    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=overlap)
    return splitter.split_text(text)

# Funzione per salvare embedding nel database
def store_embedding(filename, text, embedding):
    cur.execute(
        "INSERT INTO documents (filename, content, embedding) VALUES (%s, %s, %s)",
        (filename, text, np.array(embedding).tolist())
    )
    conn.commit()

# Directory da scansionare
FOLDER_PATH = "./docs"

# Scansione e vettorizzazione dei file
for file in os.listdir(FOLDER_PATH):
    file_path = os.path.join(FOLDER_PATH, file)
    text = ""
    print("✅ found file {}".format(file))
    if file.endswith(".pdf"):
        text = extract_text_from_pdf(file_path)
    elif file.endswith(".docx"):
        text = extract_text_from_docx(file_path)
    elif file.endswith(".txt"):
        with open(file_path, "r", encoding="utf-8") as f:
            text = f.read()

    if text:
        chunks = split_text(text)
        for chunk in chunks:
            embedding = model.encode(chunk).tolist()
            store_embedding(file, chunk, embedding)

print("✅ Vettorizzazione completata!")

