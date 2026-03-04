import { useState, FormEvent, useRef } from 'react';
import toast from 'react-hot-toast';
import { gamesApi, getErrorMessage } from '../../services/api';
import { Upload, FileText } from 'lucide-react';

interface Props {
  onSuccess: () => void;
}

export default function GameUpload({ onSuccess }: Props) {
  const [mode, setMode] = useState<'paste' | 'file'>('paste');
  const [pgn, setPgn] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePaste = async (e: FormEvent) => {
    e.preventDefault();
    if (!pgn.trim()) { toast.error('Please enter PGN'); return; }
    setLoading(true);
    try {
      await gamesApi.create(pgn);
      toast.success('Game uploaded!');
      setPgn('');
      onSuccess();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (e: FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error('Please select a PGN file'); return; }
    setLoading(true);
    try {
      await gamesApi.upload(file);
      toast.success('Game uploaded!');
      if (fileRef.current) fileRef.current.value = '';
      onSuccess();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.card}>
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(mode === 'paste' ? styles.tabActive : {}) }}
          onClick={() => setMode('paste')}
        >
          <FileText size={15} /> Paste PGN
        </button>
        <button
          style={{ ...styles.tab, ...(mode === 'file' ? styles.tabActive : {}) }}
          onClick={() => setMode('file')}
        >
          <Upload size={15} /> Upload File
        </button>
      </div>

      {mode === 'paste' ? (
        <form onSubmit={handlePaste} style={styles.form}>
          <textarea
            value={pgn}
            onChange={(e) => setPgn(e.target.value)}
            placeholder={`Paste your PGN here...\n\n[Event "Example"]\n[White "Player1"]\n[Black "Player2"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 ...`}
            style={styles.textarea}
            rows={10}
          />
          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? 'Uploading…' : 'Upload Game'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleFile} style={styles.form}>
          <div style={styles.fileArea}>
            <input
              ref={fileRef}
              type="file"
              accept=".pgn"
              style={styles.fileInput}
              id="pgn-file"
            />
            <label htmlFor="pgn-file" style={styles.fileLabel}>
              <Upload size={24} />
              <span>Click to select a .pgn file</span>
              <span style={{ fontSize: 12, color: 'var(--text-4)' }}>Max 5 MB</span>
            </label>
          </div>
          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? 'Uploading…' : 'Upload File'}
          </button>
        </form>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-strong)',
    borderRadius: 10,
    padding: 24,
    marginBottom: 28,
  },
  tabs: { display: 'flex', gap: 8, marginBottom: 20 },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'transparent',
    border: '1px solid var(--border-strong)',
    color: 'var(--text-4)',
    padding: '7px 16px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
  tabActive: {
    background: '#3b82f633',
    border: '1px solid #3b82f6',
    color: '#60a5fa',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  textarea: {
    background: 'var(--bg-input)',
    border: '1px solid var(--border-strong)',
    borderRadius: 8,
    padding: '12px 14px',
    color: 'var(--text-1)',
    fontFamily: 'monospace',
    fontSize: 13,
    resize: 'vertical',
    outline: 'none',
    minHeight: 160,
  },
  fileInput: { display: 'none' },
  fileArea: {
    border: '2px dashed var(--border-strong)',
    borderRadius: 8,
    padding: 32,
    textAlign: 'center',
    cursor: 'pointer',
  },
  fileLabel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    color: 'var(--text-3)',
    fontSize: 14,
  },
  btn: {
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '11px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    alignSelf: 'flex-start',
    paddingLeft: 24,
    paddingRight: 24,
  },
};
