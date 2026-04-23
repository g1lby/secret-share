const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { nanoid } = require('nanoid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
app.use(express.static('public', { etag: false, maxAge: 0 }));

const dataDir = './data';
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database('./data/secrets.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS secrets (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      salt TEXT,
      password_verifier TEXT,
      encrypted_values TEXT,
      values_salt TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      accessed BOOLEAN DEFAULT FALSE,
      burn_after_read BOOLEAN DEFAULT FALSE
    )
  `);
});

app.post('/api/share', (req, res) => {
  const { encryptedData, salt, burnAfterRead = false } = req.body;

  if (!encryptedData) {
    return res.status(400).json({ error: 'Encrypted data required' });
  }

  const id = nanoid(8);

  db.run(
    'INSERT INTO secrets (id, type, data, salt, burn_after_read) VALUES (?, ?, ?, ?, ?)',
    [id, 'share', encryptedData, salt || null, burnAfterRead],
    (err) => {
      if (err) {
        console.error('Error creating share:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      res.json({ id, url: `/s/${id}` });
    }
  );
});

app.post('/api/request', (req, res) => {
  const { fields, salt, passwordVerifier } = req.body;

  if (!fields || !Array.isArray(fields) || fields.length === 0) {
    return res.status(400).json({ error: 'At least one field required' });
  }

  if (!salt || !passwordVerifier) {
    return res.status(400).json({ error: 'Salt and password verifier required' });
  }

  const id = nanoid(8);
  const template = {
    fields: fields.map(f => ({ key: f.key, placeholder: f.placeholder || f.key })),
    createdAt: new Date().toISOString()
  };

  db.run(
    'INSERT INTO secrets (id, type, data, salt, password_verifier) VALUES (?, ?, ?, ?, ?)',
    [id, 'request', JSON.stringify(template), salt, passwordVerifier],
    (err) => {
      if (err) {
        console.error('Error creating request:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      res.json({ id, url: `/r/${id}` });
    }
  );
});

app.get('/api/secret/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM secrets WHERE id = ?', [id], (err, secret) => {
    if (err) {
      console.error('Error retrieving secret:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!secret) {
      return res.status(404).json({ error: 'Secret not found' });
    }

    const result = {
      type: secret.type,
      data: secret.data,
      salt: secret.salt,
      accessed: secret.accessed,
      burnAfterRead: !!secret.burn_after_read
    };

    if (secret.type === 'request') {
      result.passwordVerifier = secret.password_verifier;
      result.encryptedValues = secret.encrypted_values;
      result.valuesSalt = secret.values_salt;
    }

    res.json(result);
  });
});

app.post('/api/burn/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM secrets WHERE id = ? AND burn_after_read = 1', [id], function(err) {
    if (err) {
      console.error('Error burning secret:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.json({ burned: this.changes > 0 });
  });
});

app.post('/api/response/:id', (req, res) => {
  const { id } = req.params;
  const { encryptedData, salt } = req.body;

  if (!encryptedData) {
    return res.status(400).json({ error: 'Encrypted data required' });
  }

  db.get('SELECT * FROM secrets WHERE id = ? AND type = ?', [id, 'request'], (err, request) => {
    if (err) {
      console.error('Error finding request:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.encrypted_values) {
      return res.status(409).json({ error: 'Response already submitted' });
    }

    db.run(
      'UPDATE secrets SET encrypted_values = ?, values_salt = ? WHERE id = ?',
      [encryptedData, salt || null, id],
      (err) => {
        if (err) {
          console.error('Error saving response:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
        res.json({ id, url: `/r/${id}` });
      }
    );
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Secret Share server running on port ${PORT}`);
});