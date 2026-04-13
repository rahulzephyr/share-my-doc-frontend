import { CryptoService } from './CryptoService';

/**
 * Key manager - handles master key storage during user session
 * Keys are stored in memory only (sessionStorage) and cleared on logout
 */
class KeyManager {
  private masterKey: CryptoKey | null = null;
  private readonly STORAGE_KEY = 'whatsappmydoc_master_key';

  /**
   * Initialize and set up master key for the session
   */
  async setupKeysForRegistration(password: string): Promise<{
    salt: string;
    wrappedWrapperKey: string;
    encryptedMasterKey: string;
  }> {
    // Generate salt
    const salt = CryptoService.generateSalt();

    // Derive key from password
    const passwordKey = await CryptoService.deriveKeyFromPassword(
      password,
      salt
    );

    // Generate master key
    this.masterKey = await CryptoService.generateMasterKey();

    // Generate wrapper key
    const wrapperKey = await CryptoService.generateMasterKey();

    // Encrypt master key with wrapper key
    const masterKeyRaw = await CryptoService.exportKey(this.masterKey);
    const { encrypted: encryptedMasterKey, iv: masterIV } =
      await CryptoService.encrypt(masterKeyRaw, wrapperKey);

    // Encrypt wrapper key with password-derived key
    const wrapperKeyRaw = await CryptoService.exportKey(wrapperKey);
    const { encrypted: encryptedWrapperKey, iv: wrapperIV } =
      await CryptoService.encrypt(wrapperKeyRaw, passwordKey);

    // Combine IV + encrypted data for storage
    const combineMasterKey = new Uint8Array(
      masterIV.length + encryptedMasterKey.byteLength
    );
    combineMasterKey.set(masterIV, 0);
    combineMasterKey.set(new Uint8Array(encryptedMasterKey), masterIV.length);

    const combineWrapperKey = new Uint8Array(
      wrapperIV.length + encryptedWrapperKey.byteLength
    );
    combineWrapperKey.set(wrapperIV, 0);
    combineWrapperKey.set(
      new Uint8Array(encryptedWrapperKey),
      wrapperIV.length
    );

    // Store master key in session
    this.storeMasterKey(this.masterKey);

    return {
      salt: CryptoService.arrayBufferToBase64(salt.buffer),
      wrappedWrapperKey: CryptoService.arrayBufferToBase64(
        combineWrapperKey.buffer
      ),
      encryptedMasterKey: CryptoService.arrayBufferToBase64(
        combineMasterKey.buffer
      ),
    };
  }

  /**
   * Derive master key for login
   */
  async deriveKeysForLogin(
    password: string,
    saltBase64: string,
    wrappedWrapperKeyBase64: string,
    encryptedMasterKeyBase64: string
  ): Promise<boolean> {
    try {
      const salt = new Uint8Array(
        CryptoService.base64ToArrayBuffer(saltBase64)
      );

      // Derive password key
      const passwordKey = await CryptoService.deriveKeyFromPassword(
        password,
        salt
      );

      // Decrypt wrapper key
      const wrappedData = CryptoService.base64ToArrayBuffer(
        wrappedWrapperKeyBase64
      );
      const wrapperIV = new Uint8Array(wrappedData, 0, 12);
      const encryptedWrapper = wrappedData.slice(12);

      const wrapperKeyRaw = await CryptoService.decrypt(
        encryptedWrapper,
        passwordKey,
        wrapperIV
      );
      const wrapperKey = await CryptoService.importKey(wrapperKeyRaw);

      // Decrypt master key
      const masterData = CryptoService.base64ToArrayBuffer(
        encryptedMasterKeyBase64
      );
      const masterIV = new Uint8Array(masterData, 0, 12);
      const encryptedMaster = masterData.slice(12);

      const masterKeyRaw = await CryptoService.decrypt(
        encryptedMaster,
        wrapperKey,
        masterIV
      );
      this.masterKey = await CryptoService.importKey(masterKeyRaw);

      // Store in session
      this.storeMasterKey(this.masterKey);

      return true;
    } catch (error) {
      console.error('Failed to derive keys:', error);
      return false;
    }
  }

  /**
   * Get current master key
   */
  getMasterKey(): CryptoKey | null {
    if (this.masterKey) {
      return this.masterKey;
    }

    // Try to restore from session storage
    const stored = sessionStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const keyData = CryptoService.base64ToArrayBuffer(stored);
        CryptoService.importKey(keyData).then((key) => {
          this.masterKey = key;
        });
      } catch (error) {
        console.error('Failed to restore master key from session');
      }
    }

    return this.masterKey;
  }

  /**
   * Store master key in session storage (survives page refresh)
   */
  private async storeMasterKey(key: CryptoKey): Promise<void> {
    const keyRaw = await CryptoService.exportKey(key);
    const keyBase64 = CryptoService.arrayBufferToBase64(keyRaw);
    sessionStorage.setItem(this.STORAGE_KEY, keyBase64);
  }

  /**
   * Clear master key from memory (logout)
   */
  clearKeys(): void {
    this.masterKey = null;
    sessionStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Check if user has active session
   */
  hasActiveSession(): boolean {
    return this.masterKey !== null || sessionStorage.getItem(this.STORAGE_KEY) !== null;
  }
}

export const keyManager = new KeyManager();
