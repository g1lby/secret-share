const App = {
  currentMode: 'home',

  init() {
    this.setupNavigation();
    this.handleRoute();
    window.addEventListener('popstate', () => this.handleRoute());
  },

  setupNavigation() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.navigate(btn.dataset.mode);
      });
    });
  },

  navigate(mode) {
    this.currentMode = mode;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    if (mode === 'home') {
      history.pushState({}, '', '/');
    } else {
      history.pushState({}, '', `/${mode}`);
    }
    this.render();
  },

  handleRoute() {
    const path = window.location.pathname;
    const hash = window.location.hash.slice(1);
    if (path.startsWith('/s/')) {
      const id = path.split('/')[2];
      this.loadShare(id, hash);
      return;
    }
    if (path.startsWith('/r/')) {
      const id = path.split('/')[2];
      this.loadRequest(id, hash);
      return;
    }
    if (path === '/share') {
      this.currentMode = 'share';
    } else if (path === '/request') {
      this.currentMode = 'request';
    } else {
      this.currentMode = 'home';
    }
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === this.currentMode);
    });
    this.render();
  },

  render() {
    const container = document.getElementById('mainContent');
    const nav = document.getElementById('navTabs');
    nav.style.display = '';
    switch (this.currentMode) {
      case 'home':
        container.innerHTML = this.renderHome();
        this.attachHomeHandlers();
        break;
      case 'share':
        container.innerHTML = this.renderShare();
        this.setupShareHandlers();
        break;
      case 'request':
        container.innerHTML = this.renderRequest();
        this.setupRequestHandlers();
        break;
    }
  },

  renderHome() {
    return '<div class="home-container"><h2>Welcome to Secret Share</h2><p class="description">A secure, encrypted platform for sharing and requesting sensitive information. All encryption happens in your browser — the server never sees your secrets.</p><div class="features"><div class="feature-card"><h3>Share Secrets</h3><p>Encrypt text with AES-256-GCM and share via secure link. Optional password protection.</p><button class="btn btn-primary" id="homeShareBtn">Share a Secret</button></div><div class="feature-card"><h3>Request Secrets</h3><p>Create custom forms to request specific information from customers. They fill it in and it gets encrypted automatically.</p><button class="btn btn-primary" id="homeRequestBtn">Request Secrets</button></div></div></div>';
  },

  attachHomeHandlers() {
    var shareBtn = document.getElementById('homeShareBtn');
    var requestBtn = document.getElementById('homeRequestBtn');
    if (shareBtn) shareBtn.addEventListener('click', () => this.navigate('share'));
    if (requestBtn) requestBtn.addEventListener('click', () => this.navigate('request'));
  },

  renderShare() {
    return '<div class="share-container"><h2>Share a Secret</h2><div class="form-group"><label for="secretText">Secret Text</label><textarea id="secretText" class="form-control" rows="6" placeholder="Enter your secret here..."></textarea></div><div class="form-group"><label><input type="checkbox" id="usePassword"> Protect with password</label></div><div class="form-group password-group hidden" id="passwordGroup"><label for="password">Password</label><input type="password" id="password" class="form-control" placeholder="Enter password"></div><div class="form-group"><label><input type="checkbox" id="burnAfterRead" checked> Burn after reading (delete after first view)</label></div><button class="btn btn-primary" id="encryptBtn">Encrypt & Create Link</button><div id="shareResult" class="result-container hidden"></div></div>';
  },

  setupShareHandlers() {
    document.getElementById('usePassword').addEventListener('change', (e) => {
      document.getElementById('passwordGroup').classList.toggle('hidden', !e.target.checked);
    });
    document.getElementById('encryptBtn').addEventListener('click', () => this.handleEncrypt());
  },

  async handleEncrypt() {
    var text = document.getElementById('secretText').value;
    var usePassword = document.getElementById('usePassword').checked;
    var password = document.getElementById('password').value;
    var burnAfterRead = document.getElementById('burnAfterRead').checked;
    var resultDiv = document.getElementById('shareResult');
    if (!text) { alert('Please enter text to encrypt'); return; }
    if (usePassword && !password) { alert('Please enter a password'); return; }
    try {
      var key, salt = null;
      if (usePassword) {
        salt = Crypto.generateSalt();
        key = await Crypto.deriveKey(password, salt);
      } else {
        key = await Crypto.generateKey();
      }
      var encrypted = await Crypto.encrypt(text, key);
      var response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encryptedData: Crypto.bufferToBase64(encrypted),
          salt: salt ? Crypto.bufferToBase64(salt) : null,
          burnAfterRead: burnAfterRead
        })
      });
      var data = await response.json();
      var keyBase64 = Crypto.bufferToBase64(key);
      var fullUrl = usePassword
        ? window.location.origin + '/s/' + data.id
        : window.location.origin + '/s/' + data.id + '#' + keyBase64;
      var burnMsg = burnAfterRead
        ? '<p class="warning">This secret will be deleted after the first successful decryption.</p>'
        : '';
      resultDiv.innerHTML = '<div class="success-message"><h3>Secret Created!</h3><p>Share this link with the recipient:</p><div class="url-box"><input type="text" value="' + fullUrl + '" readonly id="shareUrl"><button class="btn btn-secondary" id="copyBtn">Copy</button></div><p>' + (usePassword ? 'Recipient will need the password to decrypt. Share it via a different channel!' : 'The key is in the URL fragment (after #) and never sent to the server.') + '</p>' + burnMsg + '</div>';
      resultDiv.classList.remove('hidden');
      document.getElementById('copyBtn').addEventListener('click', function() {
        document.getElementById('shareUrl').select();
        document.execCommand('copy');
        document.getElementById('copyBtn').textContent = 'Copied!';
      });
    } catch (error) {
      console.error('Encryption error:', error);
      alert('Error creating secret. Please try again.');
    }
  },

  renderRequest() {
    return '<div class="request-container"><h2>Request Secrets</h2><p>Create a form to request specific information from customers.</p><div id="fieldsContainer"><div class="field-row"><input type="text" class="form-control field-key" placeholder="Field name (e.g., API Key)"><button class="btn btn-danger btn-sm remove-field">\u00d7</button></div></div><button class="btn btn-secondary" id="addFieldBtn">+ Add Field</button><div class="form-group"><label for="reqPassword">Encryption Password</label><input type="password" id="reqPassword" class="form-control" placeholder="Set password for encryption"><small class="form-text">The customer will need to enter this same password to encrypt their response. You will use it to decrypt.</small></div><button class="btn btn-primary" id="createRequestBtn">Create Request Link</button><div id="requestResult" class="result-container hidden"></div></div>';
  },

  setupRequestHandlers() {
    document.getElementById('addFieldBtn').addEventListener('click', () => {
      var container = document.getElementById('fieldsContainer');
      var row = document.createElement('div');
      row.className = 'field-row';
      row.innerHTML = '<input type="text" class="form-control field-key" placeholder="Field name"><button class="btn btn-danger btn-sm remove-field">\u00d7</button>';
      container.appendChild(row);
      row.querySelector('.remove-field').addEventListener('click', () => row.remove());
    });
    document.querySelectorAll('.remove-field').forEach(btn => {
      btn.addEventListener('click', () => btn.parentElement.remove());
    });
    document.getElementById('createRequestBtn').addEventListener('click', () => this.handleCreateRequest());
  },

  async handleCreateRequest() {
    var fieldInputs = document.querySelectorAll('.field-key');
    var fields = Array.from(fieldInputs).map(function(input) { return input.value.trim(); }).filter(function(v) { return v.length > 0; }).map(function(key) { return { key: key, placeholder: key }; });
    var password = document.getElementById('reqPassword').value;
    if (fields.length === 0) { alert('Please add at least one field'); return; }
    if (!password) { alert('Please set an encryption password'); return; }
    try {
      var salt = Crypto.generateSalt();
      var key = await Crypto.deriveKey(password, salt);
      var verifier = await Crypto.encrypt('VERIFY', key);
      var response = await fetch('/api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: fields,
          salt: Crypto.bufferToBase64(salt),
          passwordVerifier: Crypto.bufferToBase64(verifier)
        })
      });
      var data = await response.json();
      var fullUrl = window.location.origin + data.url;
      var resultDiv = document.getElementById('requestResult');
      resultDiv.innerHTML = '<div class="success-message"><h3>Request Created!</h3><p>Send this link to your customer:</p><div class="url-box"><input type="text" value="' + fullUrl + '" readonly id="requestUrl"><button class="btn btn-secondary" id="copyBtn">Copy</button></div><p class="warning">Remember your password! You\'ll need it to decrypt the response.</p></div>';
      resultDiv.classList.remove('hidden');
      document.getElementById('copyBtn').addEventListener('click', function() {
        document.getElementById('requestUrl').select();
        document.execCommand('copy');
        document.getElementById('copyBtn').textContent = 'Copied!';
      });
    } catch (error) {
      console.error('Error creating request:', error);
      alert('Error creating request. Please try again.');
    }
  },

  async loadShare(id, keyBase64) {
    var container = document.getElementById('mainContent');
    document.getElementById('navTabs').style.display = 'none';
    try {
      var response = await fetch('/api/secret/' + id);
      if (!response.ok) {
        container.innerHTML = '<div class="error-container"><h2>Secret Not Found</h2><p>This secret may have expired or already been viewed.</p><button class="btn btn-primary" onclick="App.navigate(\'home\')">Go Home</button></div>';
        return;
      }
      var data = await response.json();
      if (!keyBase64 && data.salt) {
        container.innerHTML = '<div class="decrypt-container"><h2>Decrypt Secret</h2><p>This secret is password protected. Enter the password below.</p><div class="form-group"><label for="decryptPassword">Password</label><input type="password" id="decryptPassword" class="form-control" placeholder="Enter password"></div><div id="decryptError" class="error-text hidden">Incorrect password. Please try again.</div><button class="btn btn-primary" id="decryptBtn">Decrypt</button></div>';
        document.getElementById('decryptBtn').addEventListener('click', async () => {
          var password = document.getElementById('decryptPassword').value;
          var errorEl = document.getElementById('decryptError');
          var btn = document.getElementById('decryptBtn');
          btn.disabled = true;
          btn.textContent = 'Decrypting...';
          errorEl.classList.add('hidden');
          try {
            var salt = Crypto.base64ToBuffer(data.salt);
            var key = await Crypto.deriveKey(password, salt);
            var combined = Crypto.base64ToBuffer(data.data);
            var plaintext = await Crypto.decrypt(combined, key);
            if (data.burnAfterRead) {
              fetch('/api/burn/' + id, { method: 'POST' }).catch(function() {});
            }
            App.showPlaintext(plaintext, data.burnAfterRead);
          } catch (e) {
            errorEl.classList.remove('hidden');
            btn.disabled = false;
            btn.textContent = 'Decrypt';
          }
        });
      } else if (keyBase64) {
        try {
          var key = Crypto.base64ToBuffer(keyBase64);
          var combined = Crypto.base64ToBuffer(data.data);
          var plaintext = await Crypto.decrypt(combined, key);
          if (data.burnAfterRead) {
            fetch('/api/burn/' + id, { method: 'POST' }).catch(function() {});
          }
          this.showPlaintext(plaintext, data.burnAfterRead);
        } catch (e) {
          container.innerHTML = '<div class="error-container"><h2>Decryption Failed</h2><p>The decryption key is incorrect or the link has been tampered with.</p><button class="btn btn-secondary" onclick="App.navigate(\'home\')">Go Home</button></div>';
        }
      } else {
        container.innerHTML = '<div class="error-container"><h2>Missing Key</h2><p>The decryption key is missing from the URL. This link is incomplete.</p></div>';
      }
    } catch (error) {
      console.error('Error loading secret:', error);
      container.innerHTML = '<div class="error-container"><h2>Error</h2><p>Could not load secret. Please try again.</p></div>';
    }
  },

  showPlaintext(plaintext, burned) {
    var container = document.getElementById('mainContent');
    var burnedMsg = burned ? '<p class="warning">This secret has been burned and cannot be viewed again.</p>' : '';
    container.innerHTML = '<div class="secret-view"><h2>Secret</h2><div class="secret-content"><textarea class="form-control" rows="10" readonly>' + plaintext + '</textarea></div><button class="btn btn-primary" id="copySecret">Copy to Clipboard</button>' + burnedMsg + '<button class="btn btn-secondary" onclick="App.navigate(\'home\')">Go Home</button></div>';
    document.getElementById('copySecret').addEventListener('click', function() {
      document.querySelector('.secret-content textarea').select();
      document.execCommand('copy');
      document.getElementById('copySecret').textContent = 'Copied!';
    });
  },

  async loadRequest(id) {
    var container = document.getElementById('mainContent');
    document.getElementById('navTabs').style.display = 'none';
    try {
      var response = await fetch('/api/secret/' + id);
      if (!response.ok) {
        container.innerHTML = '<div class="error-container"><h2>Request Not Found</h2><p>This request may have expired.</p><button class="btn btn-primary" onclick="App.navigate(\'home\')">Go Home</button></div>';
        return;
      }
      var data = await response.json();
      if (data.encryptedValues) {
        await this.showRequestDecrypt(id, data);
        return;
      }
      var template = JSON.parse(data.data);
      this.renderRequestForm(id, template, data.salt, data.passwordVerifier);
    } catch (error) {
      console.error('Error loading request:', error);
      container.innerHTML = '<div class="error-container"><h2>Error</h2><p>Could not load request. Please try again.</p></div>';
    }
  },

  renderRequestForm(id, template, saltBase64, verifierBase64) {
    var container = document.getElementById('mainContent');
    var fieldsHtml = template.fields.map(function(field, index) {
      return '<div class="form-group"><label for="field-' + index + '">' + field.key + '</label><div class="input-with-toggle"><input type="password" id="field-' + index + '" class="form-control field-input" placeholder="' + field.placeholder + '" data-key="' + field.key + '"><button class="btn btn-sm toggle-visibility" data-target="field-' + index + '" title="Toggle visibility"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button></div></div>';
    }).join('');
    container.innerHTML = '<div class="request-form"><h2>Fill Request</h2><p>Please fill in the requested information. It will be encrypted with the requester\'s password.</p>' + fieldsHtml + '<div class="form-group"><label for="customerPassword">Encryption Password</label><input type="password" id="customerPassword" class="form-control" placeholder="Enter the password provided by the requester"><small class="form-text">Enter the password you received from the requester to encrypt your response.</small></div><div id="passwordError" class="error-text hidden"></div><button class="btn btn-primary" id="submitRequest">Encrypt & Submit</button></div>';
    container.querySelectorAll('.toggle-visibility').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var targetId = btn.dataset.target;
        var input = document.getElementById(targetId);
        if (input.type === 'password') {
          input.type = 'text';
          btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
        } else {
          input.type = 'password';
          btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        }
      });
    });
    document.getElementById('submitRequest').addEventListener('click', () => this.handleSubmitRequest(id, saltBase64, verifierBase64));
  },

  async handleSubmitRequest(id, saltBase64, verifierBase64) {
    var inputs = document.querySelectorAll('.field-input');
    var values = {};
    inputs.forEach(function(input) { values[input.dataset.key] = input.value; });
    if (Object.values(values).every(function(v) { return !v.trim(); })) {
      alert('Please fill in at least one field');
      return;
    }
    var password = document.getElementById('customerPassword').value;
    if (!password) { alert('Please enter the encryption password'); return; }
    var errorDiv = document.getElementById('passwordError');
    var submitBtn = document.getElementById('submitRequest');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying...';
    errorDiv.classList.add('hidden');
    try {
      var salt = Crypto.base64ToBuffer(saltBase64);
      var key = await Crypto.deriveKey(password, salt);
      var verifierCombined = Crypto.base64ToBuffer(verifierBase64);
      var verifierPlaintext = await Crypto.decrypt(verifierCombined, key);
      if (verifierPlaintext !== 'VERIFY') {
        errorDiv.textContent = 'Incorrect password. Please check with the requester.';
        errorDiv.classList.remove('hidden');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Encrypt & Submit';
        return;
      }
      errorDiv.classList.add('hidden');
      submitBtn.textContent = 'Encrypting...';
      var encrypted = await Crypto.encrypt(JSON.stringify(values), key);
      var response = await fetch('/api/response/' + id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encryptedData: Crypto.bufferToBase64(encrypted),
          salt: saltBase64
        })
      });
      var data = await response.json();
      if (!response.ok) { throw new Error(data.error || 'Submission failed'); }
      var container = document.getElementById('mainContent');
      container.innerHTML = '<div class="success-container"><h2>Submitted Successfully!</h2><p>Your response has been encrypted and stored.</p><p>The requester will be able to decrypt it with their password.</p><button class="btn btn-secondary" onclick="App.navigate(\'home\')">Go Home</button></div>';
    } catch (error) {
      console.error('Error submitting:', error);
      if (error.name === 'OperationError') {
        errorDiv.textContent = 'Incorrect password. Please check with the requester.';
        errorDiv.classList.remove('hidden');
      } else {
        alert('Error submitting request. Please try again.');
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Encrypt & Submit';
    }
  },

  async showRequestDecrypt(id, data) {
    var container = document.getElementById('mainContent');
    container.innerHTML = '<div class="decrypt-container"><h2>Decrypt Response</h2><p>Enter your password to view the response:</p><div class="form-group"><label for="responsePassword">Password</label><input type="password" id="responsePassword" class="form-control" placeholder="Enter password"></div><div id="decryptError" class="error-text hidden">Incorrect password. Please try again.</div><button class="btn btn-primary" id="decryptResponseBtn">Decrypt</button></div>';
    document.getElementById('decryptResponseBtn').addEventListener('click', async () => {
      var password = document.getElementById('responsePassword').value;
      var errorEl = document.getElementById('decryptError');
      var btn = document.getElementById('decryptResponseBtn');
      btn.disabled = true;
      btn.textContent = 'Decrypting...';
      errorEl.classList.add('hidden');
      try {
        var salt = Crypto.base64ToBuffer(data.salt);
        var key = await Crypto.deriveKey(password, salt);
        var combined = Crypto.base64ToBuffer(data.encryptedValues);
        var plaintext = await Crypto.decrypt(combined, key);
        var values = JSON.parse(plaintext);
        App.showDecryptedValues(values);
      } catch (error) {
        errorEl.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Decrypt';
      }
    });
  },

  showDecryptedValues(values) {
    var container = document.getElementById('mainContent');
    var valuesHtml = Object.entries(values).map(function(entry) {
      var key = entry[0];
      var value = entry[1];
      var escapedValue = value.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return '<div class="response-field"><label>' + key + '</label><div class="response-value-row"><div class="response-value">' + escapedValue + '</div><button class="btn btn-sm copy-value" data-value="' + escapedValue + '">Copy</button></div></div>';
    }).join('');
    container.innerHTML = '<div class="response-view"><h2>Decrypted Response</h2>' + valuesHtml + '<button class="btn btn-secondary" onclick="App.navigate(\'home\')">Go Home</button></div>';
    container.querySelectorAll('.copy-value').forEach(function(btn) {
      btn.addEventListener('click', function() {
        navigator.clipboard.writeText(btn.dataset.value).then(function() {
          btn.textContent = 'Copied!';
          setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
        });
      });
    });
  }
};

document.addEventListener('DOMContentLoaded', function() { App.init(); });