
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Code2,
  Pin,
  Trash2,
  FileText,
  LayoutGrid,
  Hash,
  X,
  Terminal,
  BookOpen,
  Pencil,
} from "lucide-react";
import "./App.css";

const API = "/api";

const EMPTY_FORM = {
  title: "",
  content: "",
  category: "DevOps",
  is_code: false,
};

export default function App() {
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Notes");
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ ...EMPTY_FORM });

  // Load notes from FastAPI
  async function loadNotes() {
    try {
      const response = await fetch(`${API}/notes`);

      if (!response.ok) {
        throw new Error("Could not load notes");
      }

      const data = await response.json();
      setNotes(data);
      setError("");
    } catch {
      setError("Backend unavailable. Make sure FastAPI is running.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;

    async function fetchNotes() {
      try {
        const response = await fetch(`${API}/notes`);

        if (!response.ok) {
          throw new Error("Could not load notes");
        }

        const data = await response.json();

        if (!ignore) {
          setNotes(data);
          setError("");
        }
      } catch {
        if (!ignore) {
          setError("Backend unavailable. Make sure FastAPI is running.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchNotes();

    return () => {
      ignore = true;
    };
  }, []);

  // Build category filters
  const categories = useMemo(
    () => [
      "All Notes",
      ...new Set(notes.map((note) => note.category || "General")),
    ],
    [notes]
  );

  // Search and filter notes
  const filteredNotes = notes.filter((note) => {
    const matchesCategory =
      category === "All Notes" || note.category === category;

    const searchableText =
      `${note.title} ${note.content} ${note.category}`.toLowerCase();

    return (
      matchesCategory &&
      searchableText.includes(search.toLowerCase())
    );
  });

  // Create a note
  async function createNote(event) {
    event.preventDefault();

    if (!form.title.trim()) {
      setError("Please enter a note title.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`${API}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          title: form.title.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Create failed");
      }

      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      setError("");
      await loadNotes();
    } catch {
      setError("Couldn't create note. Check the backend.");
    } finally {
      setSaving(false);
    }
  }

  // Open the edit form with existing note details
  function startEditing(note) {
    setEditingNote({
      ...note,
      category: note.category || "General",
      content: note.content || "",
    });
    setShowForm(false);
    setError("");
  }

  // Update an existing note
  async function updateNote(event) {
    event.preventDefault();

    if (!editingNote?.title.trim()) {
      setError("Please enter a note title.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`${API}/notes/${editingNote.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editingNote.title.trim(),
          content: editingNote.content,
          category: editingNote.category,
          is_code: editingNote.is_code,
        }),
      });

      if (!response.ok) {
        throw new Error("Update failed");
      }

      setEditingNote(null);
      setError("");
      await loadNotes();
    } catch {
      setError("Couldn't update note. Check the backend.");
    } finally {
      setSaving(false);
    }
  }

  // Delete a note
  async function deleteNote(id) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this note?"
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`${API}/notes/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Delete failed");
      }

      setError("");
      await loadNotes();
    } catch {
      setError("Couldn't delete this note.");
    }
  }

  // Pinning will be connected to a backend endpoint in a later step
  function togglePin() {
    setError("Pinning functionality will be added in the next step.");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(event) => event.preventDefault()}
        >
          <span className="brand-icon">
            <Code2 size={22} />
          </span>
          <span>
            DevNotes
            <small>YOUR DEVELOPER SPACE</small>
          </span>
        </a>

        <p className="nav-label">WORKSPACE</p>

        <button
          className={`nav-item ${
            category === "All Notes" ? "active" : ""
          }`}
          onClick={() => setCategory("All Notes")}
        >
          <LayoutGrid size={18} />
          All Notes
          <span className="nav-count">{notes.length}</span>
        </button>

        <p className="nav-label">CATEGORIES</p>

        {categories
          .filter((item) => item !== "All Notes")
          .map((item) => (
            <button
              key={item}
              className={`nav-item ${
                category === item ? "active" : ""
              }`}
              onClick={() => setCategory(item)}
            >
              <Hash size={17} />
              {item}
            </button>
          ))}

        <div className="sidebar-bottom">
          <span className="status-dot" />
          <span>Local workspace</span>
          <span className="online">●</span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <b>{category}</b>
          </div>

          <button
            className="primary-btn"
            onClick={() => {
              setEditingNote(null);
              setForm({ ...EMPTY_FORM });
              setError("");
              setShowForm(true);
            }}
          >
            <Plus size={18} />
            New note
          </button>
        </header>

        <section className="welcome">
          <div>
            <div className="eyebrow">
              <Terminal size={14} />
              YOUR SECOND BRAIN FOR CODE
            </div>

            <h1>
              Think it. <span>Note it.</span> Build it.
            </h1>

            <p>
              Keep your ideas, snippets and technical discoveries in one place.
            </p>
          </div>

          <div className="welcome-icon">
            <BookOpen size={38} />
          </div>
        </section>

        <section className="toolbar">
          <div>
            <h2>{category}</h2>
            <p>
              {filteredNotes.length} notes in your workspace
            </p>
          </div>

          <label className="search-box">
            <Search size={18} />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search notes or code..."
            />

            <kbd>⌘ K</kbd>
          </label>
        </section>

        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}

        {/* Create note form */}
        {showForm && (
          <form className="note-form" onSubmit={createNote}>
            <div className="form-heading">
              <h3>Create a note</h3>

              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowForm(false)}
                aria-label="Close create form"
              >
                <X size={18} />
              </button>
            </div>

            <input
              required
              maxLength={200}
              placeholder="Note title"
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
            />

            <textarea
              rows={5}
              placeholder="Write your note or paste code here..."
              value={form.content}
              onChange={(event) =>
                setForm({ ...form, content: event.target.value })
              }
            />

            <div className="form-row">
              <select
                value={form.category}
                onChange={(event) =>
                  setForm({ ...form, category: event.target.value })
                }
              >
                <option>DevOps</option>
                <option>JavaScript</option>
                <option>Python</option>
                <option>Backend</option>
                <option>General</option>
              </select>

              <label className="code-checkbox">
                <input
                  type="checkbox"
                  checked={form.is_code}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      is_code: event.target.checked,
                    })
                  }
                />
                <Code2 size={16} />
                Code snippet
              </label>

              <button className="primary-btn" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save note"}
              </button>
            </div>
          </form>
        )}

        {/* Update note form */}
        {editingNote && (
          <form className="note-form" onSubmit={updateNote}>
            <div className="form-heading">
              <h3>Edit note</h3>

              <button
                type="button"
                className="icon-btn"
                onClick={() => setEditingNote(null)}
                aria-label="Close edit form"
              >
                <X size={18} />
              </button>
            </div>

            <input
              required
              maxLength={200}
              placeholder="Note title"
              value={editingNote.title}
              onChange={(event) =>
                setEditingNote({
                  ...editingNote,
                  title: event.target.value,
                })
              }
            />

            <textarea
              rows={5}
              placeholder="Write your note or paste code here..."
              value={editingNote.content}
              onChange={(event) =>
                setEditingNote({
                  ...editingNote,
                  content: event.target.value,
                })
              }
            />

            <div className="form-row">
              <select
                value={editingNote.category}
                onChange={(event) =>
                  setEditingNote({
                    ...editingNote,
                    category: event.target.value,
                  })
                }
              >
                <option>DevOps</option>
                <option>JavaScript</option>
                <option>Python</option>
                <option>Backend</option>
                <option>General</option>
              </select>

              <label className="code-checkbox">
                <input
                  type="checkbox"
                  checked={editingNote.is_code}
                  onChange={(event) =>
                    setEditingNote({
                      ...editingNote,
                      is_code: event.target.checked,
                    })
                  }
                />
                <Code2 size={16} />
                Code snippet
              </label>

              <button className="primary-btn" type="submit" disabled={saving}>
                {saving ? "Updating..." : "Save changes"}
              </button>
            </div>
          </form>
        )}

        {/* Notes list */}
        <section className="notes-grid">
          {loading ? (
            <div className="empty-state">Loading your notes...</div>
          ) : filteredNotes.length === 0 ? (
            <div className="empty-state">
              <FileText size={34} />
              <h3>No notes found</h3>
              <p>
                Create your first note to start building your knowledge base.
              </p>

              <button
                className="primary-btn"
                onClick={() => {
                  setEditingNote(null);
                  setForm({ ...EMPTY_FORM });
                  setShowForm(true);
                }}
              >
                <Plus size={17} />
                Create first note
              </button>
            </div>
          ) : (
            filteredNotes.map((note) => (
              <article className="note-card" key={note.id}>
                <div className="note-card-top">
                  <span className="category-tag">
                    <Hash size={13} />
                    {note.category}
                  </span>

                  <button
                    className={`icon-btn ${
                      note.is_pinned ? "pinned" : ""
                    }`}
                    title="Pin note"
                    aria-label="Pin note"
                    onClick={togglePin}
                  >
                    <Pin size={17} />
                  </button>
                </div>

                <h3>{note.title}</h3>

                {note.is_code ? (
                  <pre className="code-preview">
                    <code>{note.content}</code>
                  </pre>
                ) : (
                  <p className="note-content">
                    {note.content || "No additional content."}
                  </p>
                )}

                <div className="note-card-footer">
                  <span>
                    {note.is_code ? (
                      <>
                        <Code2 size={14} /> Code snippet
                      </>
                    ) : (
                      <>
                        <FileText size={14} /> Note
                      </>
                    )}
                  </span>

                  <div className="note-actions">
                    <button
                      className="edit-btn"
                      onClick={() => startEditing(note)}
                      title="Edit note"
                    >
                      <Pencil size={14} />
                      Edit
                    </button>

                    <button
                      className="delete-btn"
                      onClick={() => deleteNote(note.id)}
                      title="Delete note"
                    >
                      <Trash2 size={15} />
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>

        <footer className="footer">
          <span>
            DEVNOTES <span className="footer-sep">/</span> BUILT FOR BUILDERS
          </span>

          <span>
            <span className="status-dot" />
            API connected locally
          </span>
        </footer>
      </main>
    </div>
  );
}
