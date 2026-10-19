import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { getLegalDocument, updateLegalDocument } from './api';

const LEGAL_PAGES = [
  { key: 'terms', label: 'Terms and Conditions', icon: 'bi-file-earmark-text' },
  { key: 'privacy', label: 'Privacy Policy', icon: 'bi-shield-lock' }
];

export default function LegalPagesAdmin({ currentUser }) {
  const [documents, setDocuments] = useState({});
  const [savedDocuments, setSavedDocuments] = useState({});
  const [selectedKey, setSelectedKey] = useState('terms');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const entries = await Promise.all(LEGAL_PAGES.map(async (page) => [page.key, await getLegalDocument(page.key)]));
        if (cancelled) return;
        const next = Object.fromEntries(entries);
        setDocuments(next);
        setSavedDocuments(next);
      } catch (error) {
        if (!cancelled) setLoadError(error.message || 'Could not load legal pages. Check the backend connection.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const selected = documents[selectedKey] || { title: '', content: '' };
  const saved = savedDocuments[selectedKey] || { title: '', content: '' };
  const hasChanges = selected.title !== saved.title || selected.content !== saved.content;
  const pageLabel = LEGAL_PAGES.find((page) => page.key === selectedKey)?.label || 'Legal page';

  const updateDraft = (field, value) => {
    setDocuments((current) => ({
      ...current,
      [selectedKey]: { ...(current[selectedKey] || {}), [field]: value }
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    if (!currentUser?.isSuperAdmin || !hasChanges || saving) return;
    if (!selected.title.trim() || !selected.content.trim()) {
      Swal.fire('Missing content', 'Add a title and document content before saving.', 'warning');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateLegalDocument(selectedKey, selected);
      setDocuments((current) => ({ ...current, [selectedKey]: updated }));
      setSavedDocuments((current) => ({ ...current, [selectedKey]: updated }));
      Swal.fire({ icon: 'success', title: 'Legal page published', text: 'The public page now uses your saved content.', timer: 1800, showConfirmButton: false });
    } catch (error) {
      Swal.fire('Could not save', error.message || 'Failed to save legal page.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const previewLines = useMemo(() => (selected.content || '').split(/\r?\n/), [selected.content]);

  if (loading) {
    return <div className="card shadow-sm border-0 p-4"><div className="text-muted"><span className="spinner-border spinner-border-sm me-2" role="status" />Loading legal pages from ShopMaster...</div></div>;
  }

  return (
    <section className="legal-admin">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h3 className="mb-1"><i className="bi bi-file-earmark-lock me-2" />Legal Pages</h3>
          <p className="text-muted mb-0">Edit the policy text shown to every ShopMaster visitor. Changes are stored in MongoDB.</p>
        </div>
        <span className="badge text-bg-info">Super admin only</span>
      </div>

      {loadError && <div className="alert alert-danger">{loadError} <button className="btn btn-sm btn-outline-danger ms-2" type="button" onClick={() => window.location.reload()}>Reload</button></div>}

      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body p-3">
          <div className="d-flex flex-wrap gap-2" role="tablist" aria-label="Choose legal document">
            {LEGAL_PAGES.map((page) => (
              <button key={page.key} type="button" role="tab" aria-selected={selectedKey === page.key}
                className={`btn ${selectedKey === page.key ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setSelectedKey(page.key)}>
                <i className={`bi ${page.icon} me-2`} />{page.label}
                {documents[page.key]?.updatedAt && <span className="ms-2 small opacity-75">Saved</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!loadError && (
        <div className="row g-4">
          <div className="col-xl-7">
            <div className="card shadow-sm border-0 h-100">
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                  <div>
                    <h4 className="mb-1">Edit {pageLabel}</h4>
                    <p className="text-muted small mb-0">Use plain text. Put `## ` at the start of a line to make a section heading.</p>
                  </div>
                  {hasChanges && <span className="badge text-bg-warning">Unsaved changes</span>}
                </div>
                <form onSubmit={save}>
                  <label className="form-label fw-semibold" htmlFor="legal-page-title">Page title</label>
                  <input id="legal-page-title" className="form-control mb-3" maxLength={120} required value={selected.title || ''} onChange={(event) => updateDraft('title', event.target.value)} />

                  <div className="d-flex justify-content-between gap-2">
                    <label className="form-label fw-semibold" htmlFor="legal-page-content">Document content</label>
                    <span className={`small ${(selected.content || '').length > 28000 ? 'text-danger' : 'text-muted'}`}>{(selected.content || '').length.toLocaleString()} / 30,000</span>
                  </div>
                  <textarea id="legal-page-content" className="form-control font-monospace mb-3" rows={22} maxLength={30000} required value={selected.content || ''} onChange={(event) => updateDraft('content', event.target.value)} spellCheck="true" />

                  <div className="d-flex flex-wrap gap-2">
                    <button type="submit" className="btn btn-success" disabled={saving || !hasChanges || !selected.title?.trim() || !selected.content?.trim()}>
                      {saving ? <><span className="spinner-border spinner-border-sm me-2" role="status" />Saving...</> : <><i className="bi bi-cloud-check me-2" />Save and publish</>}
                    </button>
                    <button type="button" className="btn btn-outline-secondary" disabled={!hasChanges || saving} onClick={() => setDocuments((current) => ({ ...current, [selectedKey]: saved }))}>Discard changes</button>
                    <button type="button" className="btn btn-outline-primary" onClick={() => window.open(selectedKey === 'terms' ? '/#terms' : '/#privacy', '_blank', 'noopener,noreferrer')}>Open public page <i className="bi bi-box-arrow-up-right ms-1" /></button>
                  </div>
                  {saved.updatedAt && <p className="small text-muted mt-3 mb-0">Last saved: {new Date(saved.updatedAt).toLocaleString()}{saved.updatedBy ? ` · By ${saved.updatedBy}` : ''}</p>}
                </form>
              </div>
            </div>
          </div>

          <div className="col-xl-5">
            <div className="card shadow-sm border-0 h-100">
              <div className="card-body p-4">
                <div className="d-flex align-items-center gap-2 mb-3"><i className="bi bi-eye text-primary fs-5" /><h4 className="mb-0">Live preview</h4></div>
                <div className="legal-admin-preview">
                  <span className="small text-uppercase text-muted fw-bold">ShopMaster</span>
                  <h3 className="mt-2 mb-3">{selected.title || pageLabel}</h3>
                  {previewLines.map((line, index) => {
                    const trimmed = line.trim();
                    if (!trimmed) return null;
                    if (trimmed.startsWith('## ')) return <h5 className="mt-4 mb-2" key={index}>{trimmed.slice(3)}</h5>;
                    return <p key={index}>{trimmed}</p>;
                  })}
                </div>
                <p className="small text-muted mt-3 mb-0">Preview is a safe text rendering. HTML and scripts are not executed.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
