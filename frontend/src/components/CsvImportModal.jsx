import { useRef, useState } from 'react';
import { api } from '../api/client';

const TEMPLATE = `symbol,direction,entry_time,exit_time,pnl,rr,grade,session,entry_price,exit_price,size,entry_confirmed,rule_broken,rule_note,notes
EURUSD,SELL,2026-06-02T08:15:00Z,2026-06-02T09:40:00Z,240,2.4,A+,LONDON,1.0842,1.0818,100000,true,false,,Clean FVG entry
XAUUSD,BUY,2026-06-04T16:30:00Z,2026-06-04T17:10:00Z,-150,-0.5,C,NEWYORK,2318.4,2312.9,1,false,true,Entered before confirmation,
`;

function downloadTemplate() {
  const blob = new Blob([TEMPLATE], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tradeiq_import_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function CsvImportModal({ onClose, onImported }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function handleFile(file) {
    if (!file) return;
    setError('');
    setResult(null);
    setUploading(true);
    try {
      const res = await api.importTrades(file);
      setResult(res);
      if (res.imported > 0) onImported();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Import Trades</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div
          className="import-drop"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFile(e.dataTransfer.files?.[0]);
          }}
        >
          {uploading ? 'Uploading…' : 'Click or drop a CSV file here'}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>

        <button type="button" className="link-btn" onClick={downloadTemplate}>
          ⬇ Download CSV template
        </button>

        {error && <div className="auth-error" style={{ marginTop: 14 }}>{error}</div>}

        {result && (
          <>
            <div className="import-summary" style={{ marginTop: 14 }}>
              Imported <strong>{result.imported}</strong> trade{result.imported === 1 ? '' : 's'}
              {result.failed > 0 && <> · {result.failed} row{result.failed === 1 ? '' : 's'} failed</>}
            </div>
            {result.errors?.length > 0 && (
              <div className="import-errors">
                {result.errors.map((e, i) => (
                  <div key={i}>Row {e.row}: {e.message}</div>
                ))}
              </div>
            )}
          </>
        )}

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
