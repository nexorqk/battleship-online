export function ShipStatusBadge({ sunk, total }: { sunk: number; total: number }) {
  return (
    <div className="ship-status">
      <span className="ship-status-label">Ships sunk</span>
      <span className="ship-status-value">
        <span className="ship-status-current">{sunk}</span>
        <span className="ship-status-sep">/</span>
        <span className="ship-status-total">{total}</span>
      </span>
      <div className="ship-status-bar">
        <div
          className="ship-status-fill"
          style={{ width: `${(sunk / total) * 100}%` }}
        />
      </div>
    </div>
  );
}
