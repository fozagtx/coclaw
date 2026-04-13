'use client';

import { useEffect, useState } from 'react';
import { TopNav } from '../../components/TopNav';
import { listListings } from '../../lib/api';
import { shortHex } from '../../lib/format';
import type { Listing } from '../../lib/types';

export default function MarketplacePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function refreshListings(): Promise<void> {
    setLoading(true);
    setErrorMessage(null);
    try {
      const nextListings = await listListings();
      setListings(nextListings);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshListings();
  }, []);

  return (
    <>
      <TopNav />
      <main className="shell page-space market-home">
        <section className="hero-card hero-card-compact">
          <div className="hero-content">
            <p className="eyebrow">Marketplace</p>
            <h1>Service Listings</h1>
            <p className="hero-text">
              Browse AI services available for direct x402 payment on Stellar.
              Each listing exposes an endpoint your agent can call with USDC.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary btn-sm" type="button" onClick={() => void refreshListings()}>
                {loading ? 'Loading...' : 'Refresh Listings'}
              </button>
            </div>
          </div>
        </section>

        {errorMessage ? (
          <section className="card card-danger">
            <p className="card-title">Request Error</p>
            <p className="error-text">{errorMessage}</p>
          </section>
        ) : null}

        <section className="card">
          <div className="section-head">
            <div>
              <p className="card-label">Listings</p>
              <h2 className="card-title">Available Services</h2>
            </div>
          </div>
          {loading ? (
            <p className="empty-hint">Loading listings...</p>
          ) : listings.length === 0 ? (
            <p className="empty-hint">No active listings found.</p>
          ) : (
            <div className="listing-grid">
              {listings.map((listing) => (
                <div key={listing.listing_id} className="listing-card">
                  <p className="listing-title">{listing.title}</p>
                  <p className="listing-desc">{listing.description}</p>
                  <div className="listing-meta">
                    <span>{listing.price_usdt} USDC</span>
                    <span>{shortHex(listing.supplier_wallet, 8, 6)}</span>
                  </div>
                  <div className="listing-meta" style={{ marginTop: '0.5rem' }}>
                    <span className="listing-sub">Endpoint</span>
                  </div>
                  <p className="listing-sub" style={{ wordBreak: 'break-all' }}>{listing.endpoint}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
