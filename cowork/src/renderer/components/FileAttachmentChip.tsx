/**
 * FileAttachmentChip — Claude Cowork parity Phase 3 step 15
 *
 * Compact chip shown in the composer for drag-dropped or file-picked
 * attachments. Displays a file-type icon, truncated name, size, and a
 * remove button. Clicking the chip routes the file to the FilePreviewPane
 * so the user can inspect it before sending.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  FileText,
  FileCode,
  FileImage,
  FileArchive,
  FileSpreadsheet,
  FileType,
  File as FileIcon,
} from 'lucide-react';

interface AttachedFile {
  name: string;
  path?: string;
  size?: number;
  type?: string;
  inlineDataBase64?: string;
}

interface FileAttachmentChipProps {
  file: AttachedFile;
  onRemove: () => void;
  onPreview?: (file: AttachedFile) => void;
}

function iconFor(file: AttachedFile): React.ReactNode {
  const name = file.name.toLowerCase();
  const type = (file.type ?? '').toLowerCase();
  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)) {
    return <FileImage size={13} className="text-accent" />;
  }
  if (/\.(zip|tar|gz|rar|7z)$/.test(name)) {
    return <FileArchive size={13} className="text-warning" />;
  }
  if (/\.(xlsx?|csv|tsv)$/.test(name)) {
    return <FileSpreadsheet size={13} className="text-success" />;
  }
  if (/\.(pdf)$/.test(name)) {
    return <FileType size={13} className="text-error" />;
  }
  if (
    /\.(ts|tsx|js|jsx|mjs|py|rb|go|rs|java|kt|swift|c|cc|cpp|h|hpp|cs|php|sh|bash|zsh|lua)$/.test(
      name
    ) ||
    type.includes('javascript') ||
    type.includes('typescript')
  ) {
    return <FileCode size={13} className="text-accent" />;
  }
  if (/\.(md|mdx|txt|rst|log)$/.test(name)) {
    return <FileText size={13} className="text-text-secondary" />;
  }
  return <FileIcon size={13} className="text-text-secondary" />;
}

function formatSize(size?: number): string {
  if (!size) return '';
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
  return `${(size / 1024 / 1024).toFixed(1)}MB`;
}

export const FileAttachmentChip: React.FC<FileAttachmentChipProps> = ({
  file,
  onRemove,
  onPreview,
}) => {
  const { t } = useTranslation();
  const handleClick = (ev: React.MouseEvent<HTMLButtonElement>) => {
    ev.preventDefault();
    onPreview?.(file);
  };

  return (
    <div className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-muted border border-border hover:border-accent transition-colors">
      <button
        type="button"
        onClick={handleClick}
        disabled={!onPreview}
        className="flex items-center gap-1.5 text-xs text-text-primary disabled:cursor-default"
        title={file.path || file.name}
      >
        {iconFor(file)}
        <span className="max-w-[140px] truncate">{file.name}</span>
        {file.size !== undefined && (
          <span className="text-[10px] text-text-muted">{formatSize(file.size)}</span>
        )}
      </button>
      <button
        type="button"
        onClick={(ev) => {
          ev.stopPropagation();
          onRemove();
        }}
        className="w-4 h-4 rounded-full bg-error/10 hover:bg-error/20 text-error flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity"
        aria-label={t('common.remove', 'Remove')}
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  );
};
