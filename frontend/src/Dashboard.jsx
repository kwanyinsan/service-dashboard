// Only HTTP 200 is classified as Up.
const StatusBadge = ({ status }) => {
  const isUp = status === 200;
  return (
    <span
      className={`status-badge ${isUp ? "status-up" : "status-down"}`}
    >
      <span className="status-dot" aria-hidden="true" />
      {isUp ? "Up" : "Down"} <span className="status-code">{status ?? "—"}</span>
    </span>
  );
};

const HistoryList = ({ history }) => {
  if (history === undefined) {
    return <p className="history-message" role="status">Loading history…</p>;
  }

  if (history === null) {
    return <p className="history-message history-error" role="status">Could not load history.</p>;
  }

  if (history.length === 0) {
    return <p className="history-message">No checks recorded yet.</p>;
  }

  return (
    <div className="history-table-wrap">
      <table className="history-table" aria-label="Last five service checks">
        <thead>
          <tr>
            <th scope="col">HTTP status</th>
            <th scope="col" className="latency-column">Latency</th>
            <th scope="col">Checked at <span className="timezone">UTC</span></th>
          </tr>
        </thead>
        <tbody>
          {history.map((entry) => (
            <tr key={entry.id}>
              <td><StatusBadge status={entry.status} /></td>
              <td className="latency-column tabular-value">
                {entry.latency != null ? <>{entry.latency} <span className="unit">ms</span></> : "—"}
              </td>
              <td className="timestamp">
                <time dateTime={`${entry.timestamp}Z`}>
                  {entry.timestamp.replace("T", " ").slice(0, 19)}
                </time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function Dashboard({ services, loading, histories, onRefresh, onDelete }) {
  if (services.length === 0) {
    return (
      <div className="empty-state">
        <h3>No services yet</h3>
        <p>Register a service above, then run a check.</p>
      </div>
    );
  }

  return (
    <div className="service-list">
      {services.map((service) => (
        <article
          key={service.id}
          className="service-card"
          aria-labelledby={`service-${service.id}`}
        >
          <div className="service-summary">
            <div className="service-details">
              <h3 id={`service-${service.id}`}>{service.name}</h3>
              <p className="service-url">{service.url}</p>
              <p className="service-last-checked">
                <span>Last checked</span>{" "}
                {service.last_checked ? (
                  <time dateTime={`${service.last_checked}Z`}>
                    {service.last_checked.replace("T", " ").slice(0, 19)} UTC
                  </time>
                ) : "Not checked yet"}
              </p>
            </div>

            <div className="service-metrics" aria-live="polite">
              <div className="metric">
                <span className="metric-label">HTTP status</span>
                {loading[service.id] ? (
                  <span className="checking-state" role="status">
                    <span className="checking-spinner" aria-hidden="true" />
                    Checking…
                  </span>
                ) : (
                  <StatusBadge status={service.status} />
                )}
              </div>
              <div className="metric latency-metric">
                <span className="metric-label">Latency</span>
                <span className="latency-value tabular-value">
                  {!loading[service.id] && service.latency != null ? (
                    <>{service.latency} <span className="unit">ms</span></>
                  ) : "—"}
                </span>
              </div>
            </div>

            <div className="service-actions">
              <button
                type="button"
                onClick={() => onRefresh(service.id)}
                className="button button-secondary button-small"
                aria-label={`Refresh ${service.name}`}
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => onDelete(service.id)}
                className="button button-danger button-small"
                aria-label={`Delete ${service.name}`}
              >
                Delete
              </button>
            </div>
          </div>

          <div className="service-history">
            <div className="history-heading">
              <h4>Last 5 checks</h4>
              <span>Newest first</span>
            </div>
            <HistoryList history={histories[service.id]} />
          </div>
        </article>
      ))}
    </div>
  );
}
