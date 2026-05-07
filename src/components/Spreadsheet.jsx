import { useState, useCallback } from 'react';
import Cell from './Cell';
import { useSpreadsheet } from '../hooks/useSpreadsheet';

export default function Spreadsheet() {
  const {
    rawValues,
    computedValues,
    errors,
    setCellValue,
    COLS,
    ROWS,
    colLabel,
  } = useSpreadsheet();

  const [activeCell, setActiveCell] = useState(null);

  const handleCellChange = useCallback(
    (cellId, value) => {
      setCellValue(cellId, value);
    },
    [setCellValue]
  );

  const handleCellFocus = useCallback((cellId) => {
    setActiveCell(cellId);
  }, []);

  const columns = Array.from({ length: COLS }, (_, i) => colLabel(i));
  const rows = Array.from({ length: ROWS }, (_, i) => i + 1);

  const activeCellRaw = activeCell ? rawValues[activeCell] : '';
  const activeCellComputed = activeCell ? computedValues[activeCell] : '';
  const activeCellError = activeCell ? errors[activeCell] : false;
  const isActiveFormula =
    typeof activeCellRaw === 'string' && activeCellRaw.startsWith('=');

  // Determine what to show in formula bar
  let formulaBarDisplay = 'Select a cell to view its contents';
  if (activeCell) {
    if (isActiveFormula) {
      formulaBarDisplay = activeCellRaw;
    } else if (activeCellRaw !== '') {
      formulaBarDisplay = activeCellRaw;
    } else {
      formulaBarDisplay = '';
    }
  }

  return (
    <div className="spreadsheet-wrapper">
      {/* Header */}
      <div className="spreadsheet-header">
        <div className="header-left">
          <svg
            className="header-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
          <h1 className="header-title">Spreadsheet</h1>
        </div>
        <div className="header-right">
          <span className="header-badge">10 × 10 Grid</span>
          <span className="header-badge header-badge-accent">
            Formula Engine
          </span>
        </div>
      </div>

      {/* Formula Bar */}
      <div className="formula-bar">
        <div className="formula-bar-cell-label">
          {activeCell || '—'}
        </div>
        <div className="formula-bar-separator" />
        <div className="formula-bar-content">
          <span className="formula-bar-fx">fx</span>
          <span
            className={`formula-bar-value ${activeCellError ? 'formula-bar-error' : ''
              } ${isActiveFormula ? 'formula-bar-formula-text' : ''}`}
          >
            {formulaBarDisplay}
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid-container">
        <table className="spreadsheet-table">
          <thead>
            <tr>
              <th className="corner-header"></th>
              {columns.map((col) => (
                <th key={col} className="col-header">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row}>
                <td className="row-header">{row}</td>
                {columns.map((col) => {
                  const cellId = `${col}${row}`;
                  return (
                    <Cell
                      key={cellId}
                      cellId={cellId}
                      rawValue={rawValues[cellId]}
                      computedValue={computedValues[cellId]}
                      error={errors[cellId]}
                      onCellChange={handleCellChange}
                      onCellFocus={handleCellFocus}
                      isActive={activeCell === cellId}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="spreadsheet-footer">
        <div className="footer-hints">
          <span className="footer-hint">
            <kbd>Enter</kbd> confirm
          </span>
          <span className="footer-hint">
            <kbd>Esc</kbd> cancel
          </span>
          <span className="footer-hint">
            <kbd>=</kbd> formula
          </span>
        </div>
        <div className="footer-info">
          Supports <span className="text-emerald-400 font-semibold">+</span>{' '}
          <span className="text-emerald-400 font-semibold">−</span>{' '}
          <span className="text-emerald-400 font-semibold">×</span>{' '}
          <span className="text-emerald-400 font-semibold">÷</span>{' '}
          and cell references (A1–J10)
        </div>
      </div>
    </div>
  );
}
