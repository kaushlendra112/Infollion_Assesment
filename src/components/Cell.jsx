import { useState, useRef, useCallback, memo } from 'react';

const Cell = memo(function Cell({
  cellId,
  rawValue,
  computedValue,
  error,
  onCellChange,
  onCellFocus,
  isActive,
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef(null);

  const startEdit = useCallback(() => {
    setEditing(true);
    setEditValue(rawValue);
    onCellFocus?.(cellId);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [rawValue, cellId, onCellFocus]);

  const handleClick = useCallback(() => {
    if (!editing) {
      startEdit();
    }
  }, [editing, startEdit]);

  const commit = useCallback(() => {
    setEditing(false);
    if (editValue !== rawValue) {
      onCellChange(cellId, editValue);
    }
  }, [cellId, editValue, rawValue, onCellChange]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        setEditing(false);
        setEditValue(rawValue);
      }
    },
    [commit, rawValue]
  );

  const isFormula = typeof rawValue === 'string' && rawValue.startsWith('=');
  const hasError = !!error;
  const displayValue =
    computedValue !== undefined && computedValue !== null
      ? String(computedValue)
      : '';

  return (
    <td
      className={`
        cell
        ${hasError ? 'cell-error' : ''}
        ${isFormula && !hasError ? 'cell-formula' : ''}
        ${editing ? 'cell-editing' : ''}
        ${isActive && !editing ? 'cell-active' : ''}
      `}
      onClick={handleClick}
      id={`cell-${cellId}`}
    >
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          className="cell-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoComplete="off"
        />
      ) : (
        <span
          className={`cell-display ${hasError ? 'text-red-400' : ''}`}
          title={isFormula ? rawValue : undefined}
        >
          {displayValue}
        </span>
      )}
    </td>
  );
});

export default Cell;
