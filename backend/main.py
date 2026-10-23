
import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from pydantic import BaseModel


app = FastAPI(title="DevNotes API")


# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Database configuration
DB_HOST = os.getenv("DB_HOST")

if DB_HOST:
    from sqlalchemy.engine import URL

    database_url = URL.create(
        drivername="mysql+pymysql",
        username=os.getenv("DB_USER", "devnotesadmin"),
        password=os.environ["DB_PASSWORD"],
        host=DB_HOST,
        port=int(os.getenv("DB_PORT", "3306")),
        database=os.getenv("DB_NAME", "devnotes"),
    )

    engine = create_engine(
        database_url,
        pool_pre_ping=True,
    )
else:
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "sqlite:///./devnotes.db",
    )

    if DATABASE_URL.startswith("sqlite:////data/"):
        Path("/data").mkdir(parents=True, exist_ok=True)

    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
    
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


# Database model
class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, default="")
    category = Column(String(50), default="General")
    is_code = Column(Boolean, default=False)
    is_pinned = Column(Boolean, default=False)


Base.metadata.create_all(bind=engine)


# Request schema
class NoteCreate(BaseModel):
    title: str
    content: str = ""
    category: str = "General"
    is_code: bool = False


# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Routes
@app.get("/")
def home():
    return {
        "message": "Welcome to DevNotes API!",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.post("/notes")
def create_note(note: NoteCreate, db: Session = Depends(get_db)):
    new_note = Note(**note.model_dump())
    db.add(new_note)
    db.commit()
    db.refresh(new_note)
    return new_note


@app.get("/notes")
def get_notes(db: Session = Depends(get_db)):
    return (
        db.query(Note)
        .order_by(Note.is_pinned.desc(), Note.id.desc())
        .all()
    )


@app.delete("/notes/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()

    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    db.delete(note)
    db.commit()
    return {"message": "Note deleted successfully"}


@app.put("/notes/{note_id}")
def update_note(
    note_id: int,
    updated_data: NoteCreate,
    db: Session = Depends(get_db),
):
    note = db.query(Note).filter(Note.id == note_id).first()

    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    note.title = updated_data.title
    note.content = updated_data.content
    note.category = updated_data.category
    note.is_code = updated_data.is_code

    db.commit()
    db.refresh(note)
    return note
