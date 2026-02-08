import React, { useEffect, useRef, useState } from 'react';

type FontOption = {
  label: string;
  value: string;
};

type SizeOption = {
  label: string;
  value: string;
};

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
};

const FONT_OPTIONS: FontOption[] = [
  { label: 'Padrão', value: 'Arial' },
  { label: 'Serif', value: 'Georgia' },
  { label: 'Mono', value: 'Courier New' },
];

const SIZE_OPTIONS: SizeOption[] = [
  { label: 'Pequeno', value: '2' },
  { label: 'Normal', value: '3' },
  { label: 'Grande', value: '4' },
];

const normalizeHtml = (html: string) => {
  if (html === '<br>' || html === '<div><br></div>') return '';
  return html;
};

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Digite aqui...',
  minHeight = 120,
}) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!editorRef.current) return;
    const next = value || '';
    if (!isFocused && editorRef.current.innerHTML !== next) {
      editorRef.current.innerHTML = next;
    }
  }, [value, isFocused]);

  const emitChange = () => {
    if (!editorRef.current) return;
    const html = normalizeHtml(editorRef.current.innerHTML);
    onChange(html);
  };

  const exec = (command: string, argument?: string) => {
    if (typeof document === 'undefined') return;
    document.execCommand(command, false, argument);
    editorRef.current?.focus();
    emitChange();
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    if (typeof document !== 'undefined') {
      if (document.queryCommandSupported?.('insertText')) {
        document.execCommand('insertText', false, text);
      } else {
        const escaped = text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br/>');
        document.execCommand('insertHTML', false, escaped);
      }
    }
    emitChange();
  };

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50 text-sm">
        <select
          className="px-2 py-1 border border-gray-200 rounded-md bg-white text-gray-700"
          onChange={(e) => exec('fontName', e.target.value)}
          defaultValue={FONT_OPTIONS[0].value}
        >
          {FONT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          className="px-2 py-1 border border-gray-200 rounded-md bg-white text-gray-700"
          onChange={(e) => exec('fontSize', e.target.value)}
          defaultValue={SIZE_OPTIONS[1].value}
        >
          {SIZE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="h-5 w-px bg-gray-200" />
        <button type="button" onClick={() => exec('bold')} className="px-2 py-1 border border-gray-200 rounded-md text-gray-700 hover:bg-gray-100">
          B
        </button>
        <button type="button" onClick={() => exec('italic')} className="px-2 py-1 border border-gray-200 rounded-md text-gray-700 hover:bg-gray-100">
          I
        </button>
        <button type="button" onClick={() => exec('underline')} className="px-2 py-1 border border-gray-200 rounded-md text-gray-700 hover:bg-gray-100">
          U
        </button>
        <div className="h-5 w-px bg-gray-200" />
        <button type="button" onClick={() => exec('insertUnorderedList')} className="px-2 py-1 border border-gray-200 rounded-md text-gray-700 hover:bg-gray-100">
          Lista
        </button>
        <button type="button" onClick={() => exec('insertOrderedList')} className="px-2 py-1 border border-gray-200 rounded-md text-gray-700 hover:bg-gray-100">
          Lista 1
        </button>
      </div>
      <div
        ref={editorRef}
        className="rte-editor px-3 py-2 text-sm text-gray-700 focus:outline-none"
        style={{ minHeight }}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emitChange}
        onBlur={() => {
          setIsFocused(false);
          emitChange();
        }}
        onFocus={() => setIsFocused(true)}
        onPaste={handlePaste}
      />
    </div>
  );
};

export default RichTextEditor;
