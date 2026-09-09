// The dev version used node:sqlite — a single file on disk. That works
// great on one long-running machine, but a Vercel serverless function's
// disk is thrown away between requests (and there can be many function
// instances running at once), so "a file on disk" can't be the database
// anymore. Supabase gives us a real, always-on Postgres server instead;
// this file just opens a connection pool to it.
//
// A "pool" (rather than one connection) is what lets many serverless
// function invocations, possibly running at the same moment, each borrow
// a connection, use it briefly, and give it back — instead of every
// request trying to open its own new connection to the database, which
// is slow and can overwhelm Postgres. Supabase's "connection pooler"
// (the pooled connection string, usually port 6543) adds another layer
// of this same idea on their side, which matters a lot for serverless.
const { Pool } = require('pg');

function getConnectionString() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL environment variable is not set. Copy your connection string from ' +
        'Supabase (Project Settings -> Database -> Connection string -> "Transaction pooler") ' +
        'into your .env file locally, and into the Vercel project settings for production.'
    );
  }
  return url;
}

const pool = new Pool({
  connectionString: getConnectionString(),
  // Supabase requires SSL. `rejectUnauthorized: false` skips verifying
  // Supabase's certificate chain, which is the commonly-used simple
  // setting for this — the connection is still encrypted, just not
  // pinned to a specific CA. Good enough here; a larger project might
  // pin Supabase's CA certificate instead.
  ssl: { rejectUnauthorized: false },
});

module.exports = pool;
