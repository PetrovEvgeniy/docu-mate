import os
import tempfile
import uuid
import asyncio

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response, FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# LangChain Imports
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_pinecone import PineconeVectorStore
from langchain_core.messages import HumanMessage, SystemMessage

from pinecone import Pinecone

# Load environment variables
load_dotenv()

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not all([PINECONE_API_KEY, PINECONE_INDEX_NAME, GEMINI_API_KEY]):
    print("Warning: Missing required environment variables. Please check your .env file.")

# Initialize FastAPI app
app = FastAPI(title="DocuMate AI API")

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize AI Services
embeddings = None
vector_store = None
llm = None

if PINECONE_API_KEY and GEMINI_API_KEY:
    try:
        embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")
        vector_store = PineconeVectorStore(
            index_name=PINECONE_INDEX_NAME, 
            embedding=embeddings
        )
        llm = ChatGoogleGenerativeAI(model="gemini-3.1-flash", streaming=True)
    except Exception as e:
        print(f"Error initializing AI services: {e}")

@app.get("/")
def read_root():
    return {"status": "ok", "message": "DocuMate AI API is running"}

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    file_path = os.path.join(os.path.dirname(__file__), "favicon.ico")
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="image/x-icon")
    return Response(status_code=204)

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Endpoint to handle document uploads, parse text, chunk, and embed to Pinecone.
    """
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported currently.")
    
    if not vector_store:
        raise HTTPException(status_code=500, detail="Vector store is not initialized properly.")

    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        # 1. Load PDF
        loader = PyPDFLoader(tmp_path)
        documents = loader.load()

        # 2. Split Text
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len
        )
        chunks = text_splitter.split_documents(documents)

        # 3. Add source metadata to chunks
        file_id = str(uuid.uuid4())
        for chunk in chunks:
            chunk.metadata["source_filename"] = file.filename
            chunk.metadata["file_id"] = file_id

        # 4. Embed and Upload to Pinecone
        vector_store.add_documents(chunks)

        # Clean up temp file
        os.remove(tmp_path)

        return {
            "status": "success", 
            "filename": file.filename, 
            "chunks_processed": len(chunks),
            "file_id": file_id
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
async def chat(request: ChatRequest):
    """
    Endpoint to handle chat queries, retrieve context from Pinecone, and generate an answer using Gemini.
    """
    if not vector_store or not llm:
        raise HTTPException(status_code=500, detail="AI Services are not initialized.")

    # 1. Vector Search
    retrieved_docs = vector_store.similarity_search(request.message, k=4)
    
    # Assemble Context
    context_text = "\n\n---\n\n".join([doc.page_content for doc in retrieved_docs])
    
    # 2. Prepare Prompt
    system_prompt = f"""You are DocuMate, a helpful assistant. Answer the user's question using ONLY the following context. 
If the answer is not in the context, say "I don't have this information in your documents."

Context:
{context_text}
"""
    
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=request.message)
    ]

    # 3. Stream Response
    async def generate():
        async for chunk in llm.astream(messages):
            yield chunk.content
            
    return StreamingResponse(generate(), media_type="text/plain")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
