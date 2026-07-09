import { useState, useCallback } from "react";
import logoSpinner from "@/assets/logo-spinner-2.gif";
import { loadSetlists, saveSetlists, createSetlist, type Setlist } from "@/utils/setlists";

interface SetlistPickerProps {
  onSelectSetlist: (id: string) => void;
}

const SetlistPicker = ({ onSelectSetlist }: SetlistPickerProps) => {
  const [setlists, setSetlists] = useState<Setlist[]>(loadSetlists);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const persist = useCallback((next: Setlist[]) => {
    setSetlists(next);
    saveSetlists(next);
  }, []);

  const handleCreate = useCallback(() => {
    if (!newName.trim()) return;
    const setlist = createSetlist(newName.trim());
    persist([...setlists, setlist]);
    setNewName("");
    setShowCreate(false);
    onSelectSetlist(setlist.id);
  }, [newName, setlists, persist, onSelectSetlist]);

  const handleDelete = useCallback((e: React.MouseEvent, setlist: Setlist) => {
    e.stopPropagation();
    if (window.confirm(`Delete setlist "${setlist.name}"? This can't be undone.`)) {
      persist(setlists.filter((s) => s.id !== setlist.id));
    }
  }, [setlists, persist]);

  const startRename = useCallback((e: React.MouseEvent, setlist: Setlist) => {
    e.stopPropagation();
    setRenamingId(setlist.id);
    setRenameValue(setlist.name);
  }, []);

  const commitRename = useCallback((id: string) => {
    if (renameValue.trim()) {
      persist(setlists.map((s) => (s.id === id ? { ...s, name: renameValue.trim() } : s)));
    }
    setRenamingId(null);
  }, [renameValue, setlists, persist]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-background px-4 py-12">
      <img src={logoSpinner} alt="Linkin Park Logo" className="w-24 h-auto mb-6 invert opacity-80" />
      <h1 className="font-display text-2xl tracking-wider text-foreground mb-1">SETLISTS</h1>
      <p className="font-mono-ui text-xs text-muted-foreground mb-10 tracking-wide">
        PICK A SHOW OR START A NEW ONE
      </p>

      <div className="w-full max-w-xl space-y-2">
        {setlists.length === 0 && (
          <div className="text-center py-10 font-mono-ui text-xs text-muted-foreground border border-dashed border-border">
            No setlists yet. Create your first one below.
          </div>
        )}

        {setlists.map((setlist) => (
          <div
            key={setlist.id}
            onClick={() => onSelectSetlist(setlist.id)}
            className="group flex items-center justify-between border border-border px-4 py-3 cursor-pointer hover:border-accent transition-colors"
          >
            {renamingId === setlist.id ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.key === "Enter" && commitRename(setlist.id)}
                onBlur={() => commitRename(setlist.id)}
                className="flex-1 bg-transparent border border-accent px-2 py-1 text-sm text-foreground font-mono-ui focus:outline-none"
              />
            ) : (
              <div>
                <div className="font-mono-ui text-sm text-foreground tracking-wide">
                  {setlist.name.toUpperCase()}
                </div>
                <div className="font-mono-ui text-xs text-muted-foreground mt-0.5">
                  {setlist.songs.length} song{setlist.songs.length === 1 ? "" : "s"}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => startRename(e, setlist)}
                className="text-muted-foreground hover:text-accent text-xs font-mono-ui"
                title="Rename setlist"
              >
                ✎
              </button>
              <button
                onClick={(e) => handleDelete(e, setlist)}
                className="text-muted-foreground hover:text-destructive text-xs font-mono-ui"
                title="Delete setlist"
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={() => setShowCreate(true)}
          className="w-full px-4 py-3 font-mono-ui text-xs border border-dashed border-border text-muted-foreground hover:text-accent hover:border-accent transition-colors"
        >
          + NEW SETLIST
        </button>
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="w-full max-w-sm bg-surface border border-border p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-mono-ui text-sm text-foreground tracking-wide">NEW SETLIST</h3>
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. Toca do Raul — 21/03"
              className="w-full bg-transparent border border-border px-3 py-2 text-sm text-foreground font-mono-ui focus:outline-none focus:border-accent"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-3 py-2 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent transition-none"
              >
                CANCEL
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="px-3 py-2 font-mono-ui text-xs border border-accent text-accent hover:bg-accent/10 disabled:opacity-40 disabled:cursor-not-allowed transition-none"
              >
                CREATE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SetlistPicker;
