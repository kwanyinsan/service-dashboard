import { useState, useEffect } from "react";
import axios from "axios";
import Dashboard from "./Dashboard";

const API = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export default function App() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState({});       // { [id]: true/false }

  const [histories, setHistories] = useState({});

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const fetchHistory = async (id) => {
    try {
      const { data } = await axios.get(`${API}/services/${id}/history`);

      // Ignore an older history response if requests finish out of order.
      setHistories((prev) => {
        const current = prev[id];

        if (
          current &&
          current.length > 0 &&
          data.length > 0 &&
          current[0].id > data[0].id
        ) {
          return prev;
        }

        return { ...prev, [id]: data };
      });
    } catch (error) {
      console.error("History request failed:", error);
      setHistories((prev) => ({ ...prev, [id]: null }));
    }
  };

  const fetchServices = async () => {
    const { data } = await axios.get(`${API}/services`);
    setServices(data);

    await Promise.all(data.map((service) => fetchHistory(service.id)));
  };

  useEffect(() => {
    fetchServices();
  }, []);

  // ── Add Service ───────────────────────────────────────────────────
  const addService = async (e) => {
    e.preventDefault();
    if (!name || !url) return;
    await axios.post(`${API}/services`, { name, url });
    setName("");
    setUrl("");
    fetchServices();
  };

  // ── Delete Service ────────────────────────────────────────────────
  const deleteService = async (id) => {
    await axios.delete(`${API}/services/${id}`);
    fetchServices();
  };

  // Clear loading even when a cached result has an unchanged timestamp.
  const refreshService = async (id) => {
    setLoading((prev) => ({ ...prev, [id]: true }));

    try {
      const { data } = await axios.post(`${API}/services/${id}/check`);

      setServices((prev) =>
        prev.map((s) => {
          if (s.id !== data.id) return s;

          if (
            !s.last_checked ||
            (data.last_checked && data.last_checked > s.last_checked)
          ) {
            return data;
          }

          return s;
        })
      );

      await fetchHistory(id);
    } catch (error) {
      console.error("Service refresh failed:", error);
      window.alert("Could not refresh this service. Please try again.");
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const refreshAll = async () => {
    services.forEach((s) =>
      setLoading((prev) => ({ ...prev, [s.id]: true }))
    );

    try {
      const { data } = await axios.post(`${API}/services/check-all`);
      setServices(data);

      await Promise.all(data.map((service) => fetchHistory(service.id)));
    } catch (error) {
      console.error("Refresh All failed:", error);
      window.alert("Could not refresh services. Please try again.");
    } finally {
      setLoading({});
    }
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="page-container header-content">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="4" y="4" width="16" height="6" rx="2" />
                <rect x="4" y="14" width="16" height="6" rx="2" />
                <path d="M8 7h.01M8 17h.01M12 7h4M12 17h4" strokeLinecap="round" />
              </svg>
            </span>
            <h1>Service Dashboard</h1>
          </div>
          <span className="header-note">Manual service checks</span>
        </div>
      </header>

      <main className="page-container main-content">
        <div className="overview-heading">
          <div>
            <h2>Service overview</h2>
            <p>HTTP status and response times, on demand.</p>
          </div>
          <button type="button" onClick={refreshAll} className="button button-primary">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20 7v5h-5M4 17v-5h5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6.1 7a7 7 0 0 1 11.7-1L20 9M4 15l2.2 3A7 7 0 0 0 17.9 17" strokeLinecap="round" />
            </svg>
            Refresh all
          </button>
        </div>

        <section className="registration-panel" aria-labelledby="registration-heading">
          <h2 id="registration-heading">Register a service</h2>
          <form onSubmit={addService} className="registration-form">
            <div className="form-field">
              <label htmlFor="service-name">Service name</label>
              <input
                id="service-name"
                name="name"
                placeholder="My service"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="service-url">URL</label>
              <input
                id="service-url"
                name="url"
                inputMode="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <button type="submit" className="button button-primary">
              <span className="plus-icon" aria-hidden="true">+</span>
              Add service
            </button>
          </form>
        </section>

        <section aria-labelledby="services-heading">
          <div className="section-heading">
            <h2 id="services-heading">Services <span className="service-count">{services.length}</span></h2>
            <span className="section-note">Checks run when you refresh</span>
          </div>
          <Dashboard
            services={services}
            loading={loading}
            histories={histories}
            onRefresh={refreshService}
            onDelete={deleteService}
          />
        </section>
      </main>
    </div>
  );
}
