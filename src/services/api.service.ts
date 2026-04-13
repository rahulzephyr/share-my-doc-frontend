import axios, { AxiosInstance } from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api";

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add auth token to requests
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem("authToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle auth errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem("authToken");
          window.location.href = "/login";
        }
        return Promise.reject(error);
      },
    );
  }

  // Auth endpoints
  async register(data: {
    phoneNumber: string; // Primary identifier
    email?: string; // Optional - for password recovery
    fullName?: string;
    salt: string;
    wrappedWrapperKey: string;
    encryptedMasterKey: string;
  }) {
    const response = await this.client.post("/auth/register", data);
    return response.data;
  }

  async loginInit(phoneNumber: string) {
    const response = await this.client.post("/auth/login-init", {
      phoneNumber,
    });
    return response.data;
  }

  async loginComplete(phoneNumber: string) {
    const response = await this.client.post("/auth/login-complete", {
      phoneNumber,
    });
    return response.data;
  }

  async getMasterKey(phoneNumber: string) {
    const response = await this.client.get(
      `/auth/master-key?phoneNumber=${phoneNumber}`,
    );
    return response.data;
  }

  // Document endpoints
  async uploadDocument(formData: FormData) {
    const response = await this.client.post("/documents/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  }

  async getDocuments() {
    const response = await this.client.get("/documents");
    return response.data;
  }

  async getDocument(id: string) {
    const response = await this.client.get(`/documents/${id}`);
    return response.data;
  }

  async downloadDocument(id: string) {
    const response = await this.client.get(`/documents/${id}/download`, {
      responseType: "arraybuffer",
    });
    return response.data;
  }

  async deleteDocument(id: string) {
    const response = await this.client.delete(`/documents/${id}`);
    return response.data;
  }

  // User endpoints
  async getProfile() {
    const response = await this.client.get("/user/profile");
    return response.data;
  }

  async linkTelegram(telegramUserId: string, telegramUsername?: string) {
    const response = await this.client.post("/user/link-telegram", {
      telegramUserId,
      telegramUsername,
    });
    return response.data;
  }

  async unlinkTelegram() {
    const response = await this.client.delete("/user/unlink-telegram");
    return response.data;
  }

  async getStats() {
    const response = await this.client.get("/user/stats");
    return response.data;
  }

  setAuthToken(token: string) {
    localStorage.setItem("authToken", token);
  }

  clearAuthToken() {
    localStorage.removeItem("authToken");
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem("authToken");
  }
}

export const apiService = new ApiService();
