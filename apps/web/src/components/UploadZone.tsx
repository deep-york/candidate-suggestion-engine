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

  return (
    <div
      {...getRootProps()}
      data-testid="upload-zone"
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        isDragActive
          ? 'border-blue-500 bg-blue-50'
          : isActive
            ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
            : 'border-gray-300 hover:border-blue-400'
      }`}
    >
      <input {...getInputProps()} />

      {state.stage === 'idle' && (
        <p className="text-sm text-gray-500">
          {isDragActive
            ? 'Drop the file here…'
            : `${label} — drag & drop or click (PDF, DOCX)`}
        </p>
      )}

      {state.stage === 'uploading' && (
        <p className="text-sm text-blue-600">Uploading…</p>
      )}

      {state.stage === 'processing' && (
        <p className="text-sm text-blue-600">
          Processing… <span className="text-gray-400">({state.status})</span>
        </p>
      )}

      {state.stage === 'done' && (
        <p className="text-sm text-green-600">✓ Document ready</p>
      )}

      {state.stage === 'error' && (
        <p className="text-sm text-red-600">Error: {state.message}</p>
      )}
    </div>
  );
}
