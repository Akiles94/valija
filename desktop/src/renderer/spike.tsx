import React, { useState } from "react";
import "./spike.css";

type TestResult = { status: "pass" | "fail"; error?: string };

const Spike: React.FC = () => {
  const [sqlcipher, setSqlcipher] = useState<TestResult | null>(null);
  const [keychain, setKeychain] = useState<TestResult | null>(null);
  const [vault, setVault] = useState<TestResult | null>(null);

  const testSqlcipher = async () => {
    try {
      // This will be replaced with actual native module test
      setSqlcipher({ status: "pass" });
    } catch (error) {
      setSqlcipher({
        status: "fail",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const testKeychain = async () => {
    try {
      // This will be replaced with actual keychain test
      setKeychain({ status: "pass" });
    } catch (error) {
      setKeychain({
        status: "fail",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const testVault = async () => {
    try {
      // This will be replaced with actual vault test
      setVault({ status: "pass" });
    } catch (error) {
      setVault({
        status: "fail",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <div className="spike-container">
      <h1>Valija Spike Tests</h1>
      <div className="test-grid">
        <div className="test-card">
          <h2>Load SQLCipher</h2>
          <button onClick={testSqlcipher}>Test</button>
          {sqlcipher && (
            <div className={`result ${sqlcipher.status}`}>
              {sqlcipher.status === "pass" ? "✓ PASS" : "✗ FAIL"}
              {sqlcipher.error && <p>{sqlcipher.error}</p>}
            </div>
          )}
        </div>

        <div className="test-card">
          <h2>Keychain Round-trip</h2>
          <button onClick={testKeychain}>Test</button>
          {keychain && (
            <div className={`result ${keychain.status}`}>
              {keychain.status === "pass" ? "✓ PASS" : "✗ FAIL"}
              {keychain.error && <p>{keychain.error}</p>}
            </div>
          )}
        </div>

        <div className="test-card">
          <h2>Open Golden Vault</h2>
          <button onClick={testVault}>Test</button>
          {vault && (
            <div className={`result ${vault.status}`}>
              {vault.status === "pass" ? "✓ PASS" : "✗ FAIL"}
              {vault.error && <p>{vault.error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Spike;
