# EchoAI FastAPI Service

This is the AI processing service for the EchoAI SaaS MVP. It handles document ingestion, embedding generation, and chat responses using LangChain and Hugging Face models.

## Setup

1. Create and activate a virtual environment:

```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate
```

2. Install core dependencies:

```bash
pip install -r requirements.txt
```

For full AI features (when implementing future tasks):

```bash
pip install -r requirements-full.txt
```

3. Copy environment configuration:

```bash
cp .env.example .env
```

4. Update the `.env` file with your configuration values.

## Running the Service

### Development

```bash
python run.py
```

### Production

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## API Endpoints

- `GET /` - Health check
- `GET /health` - Detailed health check
- `POST /api/ingest` - Document ingestion (implementation pending)
- `POST /api/chat` - Chat processing (implementation pending)

## Project Structure

```
fastapi-service/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── config.py            # Environment configuration
│   ├── models/              # Pydantic models
│   ├── routers/             # API route handlers
│   │   ├── ingest.py        # Document ingestion endpoints
│   │   └── chat.py          # Chat endpoints
│   └── services/            # Business logic services
├── requirements.txt         # Python dependencies
├── .env.example            # Environment configuration template
├── run.py                  # Development server runner
└── README.md               # This file
```

## Dependencies

- **FastAPI**: Web framework for building APIs
- **LangChain**: Document processing and RAG pipeline
- **Transformers**: Hugging Face model integration
- **Sentence Transformers**: Text embedding generation
- **Supabase**: Database and vector storage
- **Unstructured**: Document parsing and processing
