# RAG Application Architecture & Implementation Guide (Hybrid Approach)

This document outlines the architecture, data flow, and implementation steps for a production-ready Retrieval-Augmented Generation (RAG) application using a **hybrid stack**. This architecture uses **Next.js** for a high-performance frontend and **Python (FastAPI)** for robust data ingestion and AI orchestration. We will rely on **Google Gemini** for embeddings and text generation.

---

## User Review Required
> [!IMPORTANT]
> A hybrid architecture requires managing two separate codebases/services (a Node.js frontend and a Python backend). Are you comfortable setting up deployment for both (e.g., Vercel for Next.js, and Render/Heroku for Python)?

## 1. System Architecture & Tech Stack

### Core Technologies
*   **Frontend:** Next.js (App Router), React, Tailwind CSS, Vercel AI SDK (for UI streaming hooks)
*   **Backend / AI Engine:** Python, FastAPI, LangChain (for document processing), Uvicorn
*   **LLM & Embeddings:** Google Gemini (`gemini-1.5-flash` for chat, `text-embedding-004` for vectors)
*   **Database & Auth:** Supabase (PostgreSQL with `pgvector` extension)

### High-Level System Flow
1.  **User Interface:** A Next.js frontend with two tabs: **Chat** and **Data Sources**.
2.  **Ingestion (Data Sources Tab):** 
    * User uploads a document via the Next.js frontend.
    * Next.js forwards the file to the Python FastAPI backend.
    * Python uses LangChain to parse, chunk, and embed the text via Gemini.
    * Python backend stores the chunks and vectors in Supabase pgvector.
3.  **Retrieval & Generation (Chat Tab):** 
    * User sends a query from the Next.js chat interface.
    * Next.js API routes (or directly to FastAPI) handle the chat request.
    * FastAPI converts the query to an embedding, searches Supabase, and streams the Gemini LLM response back to the Next.js frontend (which renders it using Vercel AI SDK).

---

## 2. User Experience (UX) Flow

*   **Tab 1: Data Sources (Workspace)**
    *   Features a drag-and-drop file upload zone.
    *   Displays a list of processed files fetched from Supabase.
    *   Shows a loading spinner while the Python backend processes heavy files.
*   **Tab 2: Chat**
    *   Disabled or shows an empty state if no documents are in the database.
    *   Features a streaming chat interface.
    *   Responses include citations linking back to the source chunks.

---

## 3. Database Schema (Supabase pgvector)

```sql
-- Enable the pgvector extension
create extension if not exists vector;

-- Create a table to track uploaded files (metadata)
create table user_documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null, -- Links to Supabase Auth if implemented
  filename text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create a table to store the text chunks and their embeddings
create table document_chunks (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid references user_documents(id) on delete cascade not null,
  user_id uuid not null,
  content text not null,
  embedding vector(768) not null -- Gemini embedding dimension size
);

-- Create an HNSW index for fast similarity search
create index on document_chunks using hnsw (embedding vector_cosine_ops);
```

---

## 4. Implementation Pipeline

### Phase 1: Python API - Data Ingestion (`POST /upload`)
This FastAPI route handles the file, processes it, and stores it in the database.

1.  **Parse:** Receive file upload via FastAPI `UploadFile`. Use PyMuPDF or LangChain loaders to extract text.
2.  **Chunking:** Use `RecursiveCharacterTextSplitter` to chunk text (`chunk_size=1000`, `chunk_overlap=200`).
3.  **Embedding:** Iterate over chunks and call the Gemini API via Google's Python SDK.
4.  **Storage:** Insert the original chunk text and the resulting vector array into the Supabase `document_chunks` table using the `supabase-py` client.

### Phase 2: Python API - Chat & Retrieval (`POST /chat`)
This FastAPI route powers the conversational interface and streams data.

1.  **Embed User Query:** Convert the latest user message into a vector embedding using Gemini.
2.  **Vector Search:** Execute a vector search query via Supabase to find the most similar chunks.
3.  **Context Assembly:** Concatenate the retrieved text chunks into a single string to serve as context.
4.  **LLM Generation:** Use the Gemini API to generate a response based on the assembled context.
5.  **Streaming:** Return a `StreamingResponse` from FastAPI so the Next.js frontend can display words as they are generated.

### Phase 3: Next.js Frontend Integration
1.  **Upload Component:** Create a React dropzone that POSTs `FormData` to the Python `/upload` endpoint.
2.  **Chat Interface:** Use `useChat` from the Vercel AI SDK on the frontend, configured to point to your Python `/chat` endpoint. The SDK seamlessly handles the streaming response from FastAPI.

---

## 5. Architectural Advantages & Edge Cases

1.  **Solving Vercel Timeouts:** By offloading document processing to a Python backend, we avoid Vercel's strict 15-second serverless execution limits. A Python backend (hosted on Render, Railway, or Fly.io) can take as long as it needs to process large PDFs.
2.  **Ecosystem Synergy:** Python handles the heavy data parsing and AI logic (where its ecosystem shines), while Next.js handles the complex UI state and rendering (where React shines).
3.  **Deployment:** Requires deploying two separate services. 
    * Frontend: Vercel or Netlify.
    * Backend: Render, Railway, or Heroku (needs Docker or a standard ASGI server setup).
