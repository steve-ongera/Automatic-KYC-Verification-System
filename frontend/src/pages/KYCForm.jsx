import { useEffect, useRef, useState } from "react";
import { kycAPI } from "../services/api.js";

const STEPS = ["Personal Info", "Document Details", "Upload Files", "Submit"];

function UploadBox({ label, icon, value, onChange, name }) {
  const ref = useRef();
  const [preview, setPreview] = useState(null);
  const [drag, setDrag] = useState(false);

  const handleFile = (file) => {
    if (!file) return;
    onChange({ target: { name, files: [file] } });
    setPreview(URL.createObjectURL(file));
  };

  return (
    <div>
      <div className="form-label">{label}</div>
      <div
        className={`upload-area ${drag ? "drag-over" : ""}`}
        onClick={() => ref.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
      >
        <i className={`bi ${preview ? "bi-check-circle-fill" : icon}`} style={{ color: preview ? "var(--success)" : undefined }} />
        <p>{preview ? "File selected — click to change" : "Click or drag to upload"}</p>
        <span className="upload-note">JPG, PNG up to 10MB</span>
      </div>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
      {preview && <img src={preview} alt="preview" className="upload-preview" />}
    </div>
  );
}

export default function KYCForm() {
  const [step, setStep] = useState(0);
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState({ id_document_front: null, id_document_back: null, selfie_image: null });
  const [form, setForm] = useState({
    date_of_birth: "", nationality: "", phone_number: "", address: "",
    city: "", country: "", document_type: "", document_number: "", document_expiry: ""
  });

  useEffect(() => {
    kycAPI.list()
      .then(({ data }) => {
        const existing = data.results?.[0] || data[0];
        if (existing) {
          setApp(existing);
          if (existing.status === "approved") setSuccess(true);
          // Prefill form
          setForm({
            date_of_birth: existing.date_of_birth || "",
            nationality: existing.nationality || "",
            phone_number: existing.phone_number || "",
            address: existing.address || "",
            city: existing.city || "",
            country: existing.country || "",
            document_type: existing.document_type || "",
            document_number: existing.document_number || "",
            document_expiry: existing.document_expiry || "",
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleFile = (e) => setFiles({ ...files, [e.target.name]: e.target.files[0] });

  const saveStep = async () => {
    setSaving(true);
    setError("");
    try {
      if (!app) {
        const { data } = await kycAPI.create(form);
        setApp(data);
      } else {
        await kycAPI.update(app.id, form);
      }
      setStep((s) => s + 1);
    } catch (e) {
      setError(e.response?.data?.document_expiry?.[0] || "Please check your information and try again.");
    } finally {
      setSaving(false);
    }
  };

  const uploadFiles = async () => {
    if (!files.id_document_front && !files.selfie_image) {
      return setError("Please upload at least the ID document front and a selfie.");
    }
    setSaving(true);
    setError("");
    try {
      await kycAPI.uploadDocuments(app.id, files);
      setStep((s) => s + 1);
    } catch (e) {
      setError("File upload failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const submitApplication = async () => {
    setSubmitting(true);
    setError("");
    try {
      await kycAPI.submitApplication(app.id);
      setSuccess(true);
    } catch (e) {
      setError(e.response?.data?.error || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading-center"><span className="spinner spinner-lg" /></div>;

  if (success || app?.status === "approved") {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", paddingTop: 40 }}>
        <div style={{ fontSize: 72, color: "var(--success)", marginBottom: 20 }}>
          <i className="bi bi-patch-check-fill" />
        </div>
        <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Identity Verified!</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>Your KYC application has been approved successfully.</p>
        <div className="alert-banner success"><i className="bi bi-shield-check" /> Your account is fully verified and active.</div>
      </div>
    );
  }

  if (app?.status === "under_review") {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", paddingTop: 40 }}>
        <div style={{ fontSize: 64, color: "var(--info)", marginBottom: 20 }}>
          <i className="bi bi-hourglass-split" />
        </div>
        <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Under Review</h2>
        <p style={{ color: "var(--text-muted)" }}>Your application is being reviewed by our compliance team. We'll notify you once a decision is made.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>KYC Verification</h1>
          <p>Complete all steps to verify your identity</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="stepper" style={{ marginBottom: 32 }}>
        {STEPS.map((label, i) => (
          <div key={label} className={`step ${i < step ? "completed" : ""} ${i === step ? "active" : ""}`}>
            <div className="step-number">{i < step ? <i className="bi bi-check" /> : i + 1}</div>
            <span className="step-label">{label}</span>
          </div>
        ))}
      </div>

      {error && <div className="alert-banner error"><i className="bi bi-exclamation-circle" />{error}</div>}

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <i className={`bi ${["bi-person", "bi-card-image", "bi-upload", "bi-send"][step]}`} style={{ color: "var(--primary)", marginRight: 6 }} />
            Step {step + 1}: {STEPS[step]}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{step + 1} of {STEPS.length}</span>
        </div>
        <div className="card-body">

          {/* Step 0: Personal Info */}
          {step === 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Date of Birth *</label>
                <input type="date" name="date_of_birth" className="form-control" value={form.date_of_birth} onChange={handleChange} required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Phone Number *</label>
                <div className="input-group">
                  <i className="bi bi-phone input-icon" />
                  <input type="tel" name="phone_number" className="form-control" placeholder="+254 700 000 000" value={form.phone_number} onChange={handleChange} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nationality *</label>
                <input type="text" name="nationality" className="form-control" placeholder="e.g. Kenyan" value={form.nationality} onChange={handleChange} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Country *</label>
                <input type="text" name="country" className="form-control" placeholder="e.g. Kenya" value={form.country} onChange={handleChange} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">City</label>
                <input type="text" name="city" className="form-control" placeholder="e.g. Nairobi" value={form.city} onChange={handleChange} />
              </div>
              <div className="form-group" style={{ marginBottom: 0, gridColumn: "1 / -1" }}>
                <label className="form-label">Address</label>
                <textarea name="address" className="form-control" rows={2} placeholder="Street address…" value={form.address} onChange={handleChange} />
              </div>
            </div>
          )}

          {/* Step 1: Document Details */}
          {step === 1 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Document Type *</label>
                <select name="document_type" className="form-control" value={form.document_type} onChange={handleChange}>
                  <option value="">Select type…</option>
                  <option value="national_id">National ID</option>
                  <option value="passport">Passport</option>
                  <option value="drivers_license">Driver's License</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Document Number *</label>
                <div className="input-group">
                  <i className="bi bi-hash input-icon" />
                  <input type="text" name="document_number" className="form-control" placeholder="e.g. 12345678" value={form.document_number} onChange={handleChange} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Expiry Date *</label>
                <input type="date" name="document_expiry" className="form-control" value={form.document_expiry} onChange={handleChange} />
              </div>
              <div style={{ padding: "16px", background: "var(--info-light)", borderRadius: "var(--radius-sm)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <i className="bi bi-info-circle" style={{ color: "var(--info)", marginTop: 1 }} />
                <div style={{ fontSize: 12, color: "var(--info)" }}>
                  Ensure your document is valid and not expired. Expired documents will be rejected automatically.
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Upload Files */}
          {step === 2 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <UploadBox label="ID Document — Front *" icon="bi-card-image" name="id_document_front" value={files.id_document_front} onChange={handleFile} />
              <UploadBox label="ID Document — Back" icon="bi-card-back" name="id_document_back" value={files.id_document_back} onChange={handleFile} />
              <div style={{ gridColumn: "1 / -1" }}>
                <UploadBox label="Selfie Photo *" icon="bi-camera" name="selfie_image" value={files.selfie_image} onChange={handleFile} />
              </div>
              <div className="alert-banner info" style={{ gridColumn: "1 / -1" }}>
                <i className="bi bi-shield-lock" />
                Your documents are encrypted and handled securely in accordance with data protection regulations.
              </div>
            </div>
          )}

          {/* Step 3: Review & Submit */}
          {step === 3 && (
            <div>
              <div className="alert-banner info" style={{ marginBottom: 20 }}>
                <i className="bi bi-info-circle" />
                Please review your information before submitting. Once submitted, automated checks will run immediately.
              </div>
              {[
                ["Full Name", app?.user_name || "—"],
                ["Date of Birth", form.date_of_birth || "—"],
                ["Phone", form.phone_number || "—"],
                ["Nationality", form.nationality || "—"],
                ["Document Type", form.document_type?.replace("_", " ") || "—"],
                ["Document Number", form.document_number || "—"],
                ["Document Expiry", form.document_expiry || "—"],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-light)" }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, textTransform: "capitalize" }}>{value}</span>
                </div>
              ))}
              <div style={{ marginTop: 20, padding: 16, background: "var(--bg)", borderRadius: "var(--radius-sm)", fontSize: 12, color: "var(--text-secondary)" }}>
                <i className="bi bi-check-circle" style={{ color: "var(--success)", marginRight: 6 }} />
                By submitting, you confirm that all information provided is accurate and authentic. False declarations may result in legal consequences.
              </div>
            </div>
          )}

        </div>

        {/* Footer Nav */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between" }}>
          <button className="btn btn-outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || saving || submitting}>
            <i className="bi bi-arrow-left" /> Previous
          </button>

          {step < 2 && (
            <button className="btn btn-primary" onClick={saveStep} disabled={saving}>
              {saving ? <span className="spinner" /> : null}
              {saving ? "Saving…" : "Save & Continue"} <i className="bi bi-arrow-right" />
            </button>
          )}
          {step === 2 && (
            <button className="btn btn-primary" onClick={uploadFiles} disabled={saving}>
              {saving ? <span className="spinner" /> : null}
              {saving ? "Uploading…" : "Upload & Continue"} <i className="bi bi-arrow-right" />
            </button>
          )}
          {step === 3 && (
            <button className="btn btn-success" onClick={submitApplication} disabled={submitting}>
              {submitting ? <span className="spinner" /> : <i className="bi bi-send-check" />}
              {submitting ? "Submitting…" : "Submit Application"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}