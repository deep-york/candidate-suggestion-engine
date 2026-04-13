import { useDropzone } from 'react-dropzone';
import type { useUpload } from '../hooks/useUpload';

type UploadHook = ReturnType<typeof useUpload>;

interface UploadZoneProps {
  hook: UploadHook;
  label?: string;
}

export default function UploadZone({ hook, label = 'Upload file' }: UploadZoneProps) {
  const { state, upload } = hook;
  const isActive = state.stage === 'uploading' || state.stage === 'processing';

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['.docx', '.doc'],
    },
    maxFiles: 1,
    disabled: isActive,
    onDropAccepted: ([file]) => file && upload(file),
  });

  const borderColor =
    isDragActive ? 'var(--accent)'
    : state.stage === 'done' ? 'var(--green)'
    : state.stage === 'error' ? 'var(--red)'
    : isActive ? 'var(--border-strong)'
    : 'var(--border-strong)';

  return (
    <div
      {...getRootProps()}
      data-testid="upload-zone"
      style={{
        border: `1px dashed ${borderColor}`,
        padding: '22px 20px',
        textAlign: 'center',
        cursor: isActive ? 'not-allowed' : 'pointer',
        transition: 'border-color 0.2s, background 0.2s',
        background: isDragActive ? 'var(--accent-dim)' : 'transparent',
      }}
    >
      <input {...getInputProps()} />

      {state.stage === 'idle' && (
        <p
          className="font-mono"
          style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-2)' }}
        >
          {isDragActive
            ? '↓  Drop file here'
            : `${label} — Drag & drop or click · PDF, DOCX`}
        </p>
      )}

      {state.stage === 'uploading' && (
        <p className="font-mono" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)' }}>
          Uploading…
        </p>
      )}

      {state.stage === 'processing' && (
        <p className="font-mono" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)' }}>
          Processing{' '}
          <span style={{ color: 'var(--text-2)' }}>({state.status?.toUpperCase()})</span>
        </p>
      )}

      {state.stage === 'done' && (
        <p className="font-mono" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--green)' }}>
          ✓  Document Ready
        </p>
      )}

      {state.stage === 'error' && (
        <p className="font-mono" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--red)' }}>
          Error: {state.message}
        </p>
      )}
    </div>
  );
}
