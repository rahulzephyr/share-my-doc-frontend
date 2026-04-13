import React, { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { apiService } from "./services/api.service";
import { CryptoService } from "./crypto/CryptoService";

/* ═══════════════════════════════════════════════════════════════════════════
   GLOBAL CSS — MyDoc1.html design system
   ═══════════════════════════════════════════════════════════════════════════ */

const CSS = `
:root {
  --ink: #0D1117;
  --ink-2: #3D4A5C;
  --ink-3: #7A8899;
  --surface: #FFFFFF;
  --surface-2: #F5F7FA;
  --surface-3: #EEF1F6;
  --accent: #1A56DB;
  --accent-soft: #EBF0FF;
  --accent-dark: #0F3BA8;
  --danger: #E53535;
  --danger-soft: #FEE8E8;
  --success: #0E7D4F;
  --success-soft: #E4F5EE;
  --border: #E2E8F0;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--surface-2);
  color: var(--ink);
  min-height: 100vh;
}
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse 900px 600px at 10% 0%, rgba(26,86,219,0.04) 0%, transparent 70%),
    radial-gradient(ellipse 600px 400px at 90% 100%, rgba(26,86,219,0.03) 0%, transparent 70%);
  pointer-events: none;
  z-index: 0;
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

/* ═══════════════════════════════════════════════════════════════════════════
   AUTH GUARD
   ═══════════════════════════════════════════════════════════════════════════ */

function RequireAuth({ children }: { children: React.ReactNode }) {
  return apiService.isAuthenticated() ? (
    <>{children}</>
  ) : (
    <Navigate to="/login" replace />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   AUTH PAGE — Combined Login + Signup (MyDoc1.html style)
   ═══════════════════════════════════════════════════════════════════════════ */

function AuthPage() {
  const navigate = useNavigate();

  // Signup state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupEmail, setSignupEmail] = useState(""); // Optional - for recovery
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signupMsg, setSignupMsg] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);

  // Login state
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginMsg, setLoginMsg] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSignupMsg(null);

    if (!firstName || !lastName || !signupPhone || !signupPassword) {
      setSignupMsg({ text: "All fields are required.", type: "error" });
      return;
    }
    if (signupPhone.length < 10) {
      setSignupMsg({
        text: "Please enter a valid phone number.",
        type: "error",
      });
      return;
    }
    if (signupPassword !== confirmPassword) {
      setSignupMsg({ text: "Passwords do not match.", type: "error" });
      return;
    }

    const validation = CryptoService.validatePassword(signupPassword);
    if (!validation.valid) {
      setSignupMsg({ text: validation.errors[0], type: "error" });
      return;
    }

    setSignupLoading(true);
    try {
      const salt = CryptoService.generateSalt();
      const wrapperKey = await CryptoService.deriveKeyFromPassword(
        signupPassword,
        salt,
      );
      const masterKey = await CryptoService.generateMasterKey();
      const masterKeyRaw = await CryptoService.exportKey(masterKey);
      const { encrypted: wrappedMasterKey, iv: wrapIv } =
        await CryptoService.encrypt(masterKeyRaw, wrapperKey);

      const combined = new Uint8Array(
        wrapIv.length + wrappedMasterKey.byteLength,
      );
      combined.set(wrapIv, 0);
      combined.set(new Uint8Array(wrappedMasterKey), wrapIv.length);

      const encryptedMasterKey = CryptoService.arrayBufferToBase64(
        combined.buffer,
      );
      const saltB64 = CryptoService.arrayBufferToBase64(
        salt.buffer as ArrayBuffer,
      );

      const result = await apiService.register({
        phoneNumber: signupPhone,
        email: signupEmail || undefined,
        fullName: `${firstName} ${lastName}`.trim(),
        salt: saltB64,
        wrappedWrapperKey: encryptedMasterKey,
        encryptedMasterKey,
      });

      apiService.setAuthToken(result.token);
      sessionStorage.setItem("userPhone", signupPhone);
      sessionStorage.setItem("userName", `${firstName} ${lastName}`.trim());

      setSignupMsg({
        text: "Account created! Redirecting...",
        type: "success",
      });
      setTimeout(() => navigate("/dashboard"), 500);
    } catch (err: any) {
      setSignupMsg({
        text: err?.response?.data?.error || "Registration failed",
        type: "error",
      });
    } finally {
      setSignupLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginMsg(null);

    if (!loginPhone || !loginPassword) {
      setLoginMsg({
        text: "Please enter phone number and password.",
        type: "error",
      });
      return;
    }

    setLoginLoading(true);
    try {
      const initData = await apiService.loginInit(loginPhone);
      const salt = new Uint8Array(
        CryptoService.base64ToArrayBuffer(initData.salt),
      );
      await CryptoService.deriveKeyFromPassword(loginPassword, salt);

      const result = await apiService.loginComplete(loginPhone);
      apiService.setAuthToken(result.token);

      sessionStorage.setItem("userPhone", loginPhone);
      sessionStorage.setItem("userName", result.user.fullName || loginPhone);

      setLoginMsg({ text: "Signing in...", type: "success" });
      setTimeout(() => navigate("/dashboard"), 500);
    } catch (err: any) {
      setLoginMsg({
        text: err?.response?.data?.error || "Invalid credentials",
        type: "error",
      });
    } finally {
      setLoginLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.logoMark}>
            <svg
              viewBox="0 0 24 24"
              style={{ width: 22, height: 22, fill: "white" }}
            >
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            </svg>
          </div>
          <div style={styles.logoText}>
            <span style={styles.logoTitle}>MyDoc</span>
            <span style={styles.logoSub}>Secure Document Vault</span>
          </div>
        </header>

        {/* Auth Wrapper */}
        <div style={styles.authWrapper}>
          {/* Signup Panel */}
          <div style={styles.authPanel}>
            <p style={styles.eyebrow}>Get Started</p>
            <h2 style={styles.panelTitle}>Create Account</h2>
            <p style={styles.panelSub}>
              Store and manage your documents securely.
            </p>

            <form onSubmit={handleSignup}>
              <div style={styles.formRow}>
                <div style={styles.field}>
                  <label style={styles.label}>First Name</label>
                  <input
                    style={styles.input}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    required
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Last Name</label>
                  <input
                    style={styles.input}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Phone Number</label>
                <input
                  style={styles.input}
                  type="tel"
                  value={signupPhone}
                  onChange={(e) => setSignupPhone(e.target.value)}
                  placeholder="+1234567890"
                  required
                />
                <small style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                  Used to link your Telegram account
                </small>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>
                  Email{" "}
                  <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                    (optional - for password recovery)
                  </span>
                </label>
                <input
                  style={styles.input}
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="john@example.com"
                />
              </div>
              <div style={styles.formRow}>
                <div style={styles.field}>
                  <label style={styles.label}>Password</label>
                  <input
                    style={styles.input}
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Confirm Password</label>
                  <input
                    style={styles.input}
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
              <button
                style={styles.btnPrimary}
                type="submit"
                disabled={signupLoading}
              >
                {signupLoading ? "Creating..." : "Create Account"}
              </button>
              {signupMsg && (
                <div
                  style={{
                    ...styles.message,
                    ...(signupMsg.type === "error"
                      ? styles.errorMsg
                      : styles.successMsg),
                  }}
                >
                  {signupMsg.text}
                </div>
              )}
            </form>
          </div>

          <div style={styles.dividerVert} />

          {/* Login Panel */}
          <div style={{ ...styles.authPanel, background: "var(--surface-2)" }}>
            <p style={styles.eyebrow}>Welcome Back</p>
            <h2 style={styles.panelTitle}>Sign In</h2>
            <p style={styles.panelSub}>Access your secure document vault.</p>

            <form onSubmit={handleLogin}>
              <div style={styles.field}>
                <label style={styles.label}>Phone Number</label>
                <input
                  style={styles.input}
                  type="tel"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  placeholder="+1234567890"
                  required
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Password</label>
                <input
                  style={styles.input}
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <button
                style={{ ...styles.btnPrimary, ...styles.btnGhost }}
                type="submit"
                disabled={loginLoading}
              >
                {loginLoading ? "Signing in..." : "Sign In"}
              </button>
              {loginMsg && (
                <div
                  style={{
                    ...styles.message,
                    ...(loginMsg.type === "error"
                      ? styles.errorMsg
                      : styles.successMsg),
                  }}
                >
                  {loginMsg.text}
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Footer */}
        <div style={styles.authFooter}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          End-to-end encrypted. Your documents stay private — only you hold the
          keys.
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DASHBOARD PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

interface DocumentRecord {
  id: string;
  encryptedMetadata: string;
  iv: string;
  fileSizeBytes: number;
  mimeType: string;
  uploadedAt: string;
  keyName?: string;
  docType?: string;
  fileName?: string;
}

const DOC_TYPES = [
  "Aadhaar Card",
  "PAN Card",
  "Voter ID",
  "Passport",
  "Driving License",
  "Bank Statement",
  "Insurance Policy",
  "Others",
];

function DashboardPage() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Upload form state
  const [docType, setDocType] = useState("Aadhaar Card");
  const [keyName, setKeyName] = useState("");
  const [customDocName, setCustomDocName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMsg, setUploadMsg] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const userName = sessionStorage.getItem("userName") || "User";
  const initials =
    userName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "?";

  useEffect(() => {
    fetchDocuments();
  }, []);

  async function fetchDocuments() {
    try {
      const data = await apiService.getDocuments();
      const docsWithMeta = data.documents.map((doc: DocumentRecord) => {
        try {
          const meta = JSON.parse(atob(doc.encryptedMetadata));
          return {
            ...doc,
            keyName: meta.keyName,
            docType: meta.docType,
            fileName: meta.fileName,
          };
        } catch {
          return doc;
        }
      });
      setDocs(docsWithMeta);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      setUploadMsg({ text: "Please select a file.", type: "error" });
      return;
    }

    const finalKeyName = keyName.trim();
    if (!finalKeyName) {
      setUploadMsg({
        text: "Please enter a key name for retrieval.",
        type: "error",
      });
      return;
    }

    const finalDocType =
      docType === "Others"
        ? customDocName.trim() || "Custom Document"
        : docType;

    setUploading(true);
    setUploadMsg(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const iv = CryptoService.generateIV();
      const ivB64 = CryptoService.arrayBufferToBase64(iv.buffer as ArrayBuffer);

      const metadata = {
        keyName: finalKeyName,
        docType: finalDocType,
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        uploadedAt: new Date().toISOString(),
      };
      const metaB64 = btoa(JSON.stringify(metadata));

      const formData = new FormData();
      formData.append("encryptedFile", new Blob([buffer]), selectedFile.name);
      formData.append("encryptedMetadata", metaB64);
      formData.append("iv", ivB64);
      formData.append("mimeType", selectedFile.type);
      formData.append("keyName", finalKeyName); // For Telegram retrieval

      await apiService.uploadDocument(formData);

      setUploadMsg({
        text: `"${finalKeyName}" attached successfully!`,
        type: "success",
      });
      setSelectedFile(null);
      setKeyName("");
      setCustomDocName("");
      setDocType("Aadhaar Card");
      await fetchDocuments();
    } catch (err: any) {
      setUploadMsg({
        text: err?.response?.data?.error || "Upload failed",
        type: "error",
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string, name?: string) {
    if (!confirm(`Remove "${name || "this document"}"?`)) return;
    try {
      await apiService.deleteDocument(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
      setUploadMsg({ text: "Document removed.", type: "success" });
    } catch {
      setUploadMsg({ text: "Failed to delete document.", type: "error" });
    }
  }

  function handleLogout() {
    apiService.clearAuthToken();
    sessionStorage.clear();
    navigate("/login");
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.logoMark}>
            <svg
              viewBox="0 0 24 24"
              style={{ width: 22, height: 22, fill: "white" }}
            >
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            </svg>
          </div>
          <div style={styles.logoText}>
            <span style={styles.logoTitle}>MyDoc</span>
            <span style={styles.logoSub}>Secure Document Vault</span>
          </div>
        </header>

        {/* Top Bar */}
        <div style={styles.topBar}>
          <div style={styles.welcomeBlock}>
            <div style={styles.avatar}>{initials}</div>
            <div>
              <h3
                style={{
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: "var(--ink)",
                  margin: 0,
                }}
              >
                Hello, {userName}
              </h3>
              <p
                style={{
                  fontSize: "0.78rem",
                  color: "var(--ink-3)",
                  margin: "1px 0 0",
                }}
              >
                Manage your documents below
              </p>
            </div>
          </div>
          <button style={styles.btnLogout} onClick={handleLogout}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </div>

        {/* Dashboard Grid */}
        <div style={styles.dashGrid}>
          {/* Upload Card */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardTitle}>
                <div style={styles.iconBox}>
                  <svg
                    viewBox="0 0 24 24"
                    style={{
                      width: 14,
                      height: 14,
                      stroke: "var(--accent)",
                      fill: "none",
                      strokeWidth: 2,
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                    }}
                  >
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                Attach Document
              </div>
            </div>
            <div style={styles.cardBody}>
              {/* Key Name */}
              <div style={styles.field}>
                <label style={styles.label}>
                  Key Name{" "}
                  <span style={{ color: "var(--danger)", fontSize: 10 }}>
                    *
                  </span>
                </label>
                <input
                  style={styles.input}
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g. my passport, bank stmt, aadhaar"
                />
                <small
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--ink-3)",
                    marginTop: 4,
                    display: "block",
                  }}
                >
                  Use this name to retrieve via Telegram: "get my passport"
                </small>
              </div>

              {/* Document Type */}
              <div style={styles.field}>
                <label style={styles.label}>Document Type</label>
                <select
                  style={styles.select}
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Name (if Others) */}
              {docType === "Others" && (
                <div style={styles.field}>
                  <label style={styles.label}>Custom Document Name</label>
                  <input
                    style={styles.input}
                    value={customDocName}
                    onChange={(e) => setCustomDocName(e.target.value)}
                    placeholder="e.g. Rental Agreement"
                  />
                </div>
              )}

              {/* File Dropzone */}
              <div style={styles.field}>
                <label style={styles.label}>Choose File</label>
                <div
                  style={styles.dropzone}
                  onClick={() => document.getElementById("fileInput")?.click()}
                >
                  <svg
                    viewBox="0 0 24 24"
                    style={{
                      width: 28,
                      height: 28,
                      stroke: "var(--ink-3)",
                      fill: "none",
                      strokeWidth: 1.5,
                      marginBottom: 8,
                    }}
                  >
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                  <p
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--ink-3)",
                      margin: 0,
                    }}
                  >
                    <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                      Click to upload
                    </span>{" "}
                    or drag and drop
                  </p>
                  <small style={{ fontSize: "0.7rem", color: "#B0BAC9" }}>
                    PDF, JPG, PNG, DOCX
                  </small>
                </div>
                <input
                  id="fileInput"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.docx"
                  style={{ display: "none" }}
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
                {selectedFile && (
                  <div style={styles.fileSelected}>
                    <svg
                      viewBox="0 0 24 24"
                      style={{
                        width: 14,
                        height: 14,
                        stroke: "var(--accent)",
                        fill: "none",
                        strokeWidth: 2,
                        flexShrink: 0,
                      }}
                    >
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    {selectedFile.name}
                  </div>
                )}
              </div>

              <button
                style={{ ...styles.btnPrimary, marginTop: 4 }}
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? "Uploading..." : "Attach Document"}
              </button>
              {uploadMsg && (
                <div
                  style={{
                    ...styles.message,
                    ...(uploadMsg.type === "error"
                      ? styles.errorMsg
                      : styles.successMsg),
                  }}
                >
                  {uploadMsg.text}
                </div>
              )}
            </div>
          </div>

          {/* Documents List Card */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardTitle}>
                <div style={styles.iconBox}>
                  <svg
                    viewBox="0 0 24 24"
                    style={{
                      width: 14,
                      height: 14,
                      stroke: "var(--accent)",
                      fill: "none",
                      strokeWidth: 2,
                    }}
                  >
                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                  </svg>
                </div>
                My Documents
              </div>
              <span style={styles.docCount}>{docs.length}</span>
            </div>
            <div
              style={{ ...styles.cardBody, paddingTop: 8, paddingBottom: 8 }}
            >
              {loading ? (
                <p
                  style={{
                    color: "var(--ink-3)",
                    textAlign: "center",
                    padding: 24,
                  }}
                >
                  Loading...
                </p>
              ) : docs.length === 0 ? (
                <div style={styles.emptyState}>
                  <svg
                    viewBox="0 0 24 24"
                    style={{
                      width: 40,
                      height: 40,
                      stroke: "#D0D8E4",
                      fill: "none",
                      strokeWidth: 1.5,
                      marginBottom: 8,
                    }}
                  >
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <p>No documents attached yet.</p>
                </div>
              ) : (
                docs.map((doc) => (
                  <div key={doc.id} style={styles.docItem}>
                    <div style={styles.docIcon}>
                      <svg
                        viewBox="0 0 24 24"
                        style={{
                          width: 16,
                          height: 16,
                          stroke: "var(--ink-3)",
                          fill: "none",
                          strokeWidth: 1.8,
                        }}
                      >
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div style={styles.docInfo}>
                      <strong
                        style={{
                          display: "block",
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          color: "var(--ink)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {doc.keyName || "Unnamed Document"}
                      </strong>
                      <small
                        style={{ fontSize: "0.72rem", color: "var(--ink-3)" }}
                      >
                        {doc.fileName || "file"} ·{" "}
                        {new Date(doc.uploadedAt).toLocaleDateString()}
                      </small>
                    </div>
                    <span style={styles.docTag}>
                      {doc.docType || "Document"}
                    </span>
                    <button
                      style={styles.deleteBtn}
                      onClick={() => handleDelete(doc.id, doc.keyName)}
                      title="Remove"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        style={{
                          width: 14,
                          height: 14,
                          stroke: "currentColor",
                          fill: "none",
                          strokeWidth: 2,
                        }}
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4h6v2" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Telegram Hint */}
        <div style={styles.telegramHint}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
          </svg>
          <span>
            <strong>Retrieve via Telegram:</strong> Message our bot with your
            key name, e.g. "get my passport" or just "passport"
          </span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "2.5rem 1.5rem 4rem",
    position: "relative",
  },
  container: { width: "100%", maxWidth: 1060, position: "relative", zIndex: 1 },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "2.8rem",
  },
  logoMark: {
    width: 42,
    height: 42,
    background: "#1A56DB",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 12px rgba(26,86,219,0.3)",
  },
  logoText: { display: "flex", flexDirection: "column", lineHeight: 1 },
  logoTitle: {
    fontFamily: "'DM Serif Display', Georgia, serif",
    fontSize: "1.5rem",
    color: "#0D1117",
    letterSpacing: -0.5,
  },
  logoSub: {
    fontSize: "0.7rem",
    fontWeight: 500,
    color: "#7A8899",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    marginTop: 2,
  },
  authWrapper: {
    display: "grid",
    gridTemplateColumns: "1fr 1px 1fr",
    background: "#FFFFFF",
    borderRadius: 20,
    boxShadow: "0 12px 40px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.06)",
    border: "1px solid #E2E8F0",
    overflow: "hidden",
  },
  dividerVert: { background: "#E2E8F0" },
  authPanel: { padding: "2.8rem 2.5rem", background: "#FFFFFF" },
  eyebrow: {
    fontSize: "0.7rem",
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#1A56DB",
    marginBottom: "0.4rem",
  },
  panelTitle: {
    fontFamily: "'DM Serif Display', Georgia, serif",
    fontSize: "1.9rem",
    color: "#0D1117",
    letterSpacing: -0.5,
    marginBottom: "0.5rem",
  },
  panelSub: { fontSize: "0.85rem", color: "#7A8899", marginBottom: "2rem" },
  formRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" },
  field: { marginBottom: "1.1rem" },
  label: {
    display: "block",
    fontSize: "0.78rem",
    fontWeight: 600,
    color: "#3D4A5C",
    marginBottom: "0.35rem",
    letterSpacing: "0.01em",
  },
  input: {
    width: "100%",
    padding: "0.7rem 0.95rem",
    border: "1.5px solid #E2E8F0",
    borderRadius: 8,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "0.9rem",
    color: "#0D1117",
    background: "#FFFFFF",
    outline: "none",
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    padding: "0.7rem 0.95rem",
    border: "1.5px solid #E2E8F0",
    borderRadius: 8,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "0.9rem",
    color: "#0D1117",
    background: "#FFFFFF",
    cursor: "pointer",
    outline: "none",
    boxSizing: "border-box",
  },
  btnPrimary: {
    width: "100%",
    padding: "0.8rem 1.5rem",
    background: "#1A56DB",
    color: "white",
    border: "none",
    borderRadius: 8,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "0.9rem",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(26,86,219,0.25)",
    marginTop: "0.4rem",
    letterSpacing: "0.01em",
  },
  btnGhost: {
    background: "transparent",
    border: "1.5px solid #E2E8F0",
    color: "#3D4A5C",
    boxShadow: "none",
  },
  message: {
    marginTop: "0.9rem",
    padding: "0.6rem 0.9rem",
    borderRadius: 8,
    fontSize: "0.82rem",
    fontWeight: 500,
  },
  errorMsg: { background: "#FEE8E8", color: "#E53535" },
  successMsg: { background: "#E4F5EE", color: "#0E7D4F" },
  authFooter: {
    marginTop: "1rem",
    padding: "1rem 2.5rem",
    background: "#EEF1F6",
    borderRadius: "0 0 20px 20px",
    border: "1px solid #E2E8F0",
    borderTop: "none",
    fontSize: "0.75rem",
    color: "#7A8899",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 20,
    padding: "1.2rem 1.8rem",
    marginBottom: "1.5rem",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  },
  welcomeBlock: { display: "flex", alignItems: "center", gap: "1rem" },
  avatar: {
    width: 44,
    height: 44,
    background: "#EBF0FF",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'DM Serif Display', Georgia, serif",
    fontSize: "1.2rem",
    color: "#1A56DB",
    fontWeight: 600,
    flexShrink: 0,
  },
  btnLogout: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.55rem 1.1rem",
    background: "transparent",
    border: "1.5px solid #E2E8F0",
    borderRadius: 8,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "0.82rem",
    fontWeight: 600,
    color: "#7A8899",
    cursor: "pointer",
  },
  dashGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1.4fr",
    gap: "1.5rem",
    alignItems: "start",
  },
  card: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
    overflow: "hidden",
  },
  cardHeader: {
    padding: "1.4rem 1.8rem 1rem",
    borderBottom: "1px solid #E2E8F0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: "0.95rem",
    fontWeight: 600,
    color: "#0D1117",
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    background: "#EBF0FF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { padding: "1.4rem 1.8rem" },
  dropzone: {
    border: "1.5px dashed #E2E8F0",
    borderRadius: 8,
    padding: "1.4rem 1rem",
    textAlign: "center",
    cursor: "pointer",
    background: "#F5F7FA",
  },
  fileSelected: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    marginTop: "0.6rem",
    padding: "0.55rem 0.8rem",
    background: "#EBF0FF",
    borderRadius: 7,
    fontSize: "0.78rem",
    color: "#1A56DB",
    fontWeight: 500,
  },
  docCount: {
    fontSize: "0.75rem",
    background: "#EEF1F6",
    color: "#7A8899",
    padding: "0.2rem 0.6rem",
    borderRadius: 20,
    fontWeight: 600,
  },
  emptyState: {
    textAlign: "center",
    padding: "2.5rem 1rem",
    color: "#7A8899",
    fontSize: "0.85rem",
  },
  docItem: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    padding: "0.85rem 0",
    borderBottom: "1px solid #E2E8F0",
  },
  docIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    background: "#F5F7FA",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    border: "1px solid #E2E8F0",
  },
  docInfo: { flex: 1, minWidth: 0 },
  docTag: {
    fontSize: "0.68rem",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    padding: "0.2rem 0.55rem",
    borderRadius: 5,
    background: "#EBF0FF",
    color: "#1A56DB",
    flexShrink: 0,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    background: "none",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#7A8899",
    flexShrink: 0,
  },
  telegramHint: {
    marginTop: "1.5rem",
    padding: "1rem 1.5rem",
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 12,
    fontSize: "0.8rem",
    color: "#3D4A5C",
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   APP / ROUTER
   ═══════════════════════════════════════════════════════════════════════════ */

export default function App() {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => {
      style.remove();
      link.remove();
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="*"
          element={
            <Navigate
              to={apiService.isAuthenticated() ? "/dashboard" : "/login"}
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
