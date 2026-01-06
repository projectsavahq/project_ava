'use strict';

// voice-test.js - externalized client logic to satisfy CSP (no inline scripts)

// Use origin where the page is served so login/fetch calls go to the same backend port (e.g. 3002)
// If running on Live Server (port 5500), point to default backend port 3001
const API_BASE = (window.location.port === '5500')
    ? 'http://localhost:3001'
    : (window.location && window.location.origin && window.location.origin !== 'null')
        ? window.location.origin
        : 'http://localhost:3001';

console.info('[voice-test.js] loaded; API_BASE =', API_BASE);

// Ensure socket.io is loaded (fallback to CDN if not present)
function ensureSocketIo(callback) {
    if (typeof io !== 'undefined') return callback();
    const s = document.createElement('script');
    s.src = 'https://cdn.socket.io/4.5.0/socket.io.min.js';
    s.onload = callback;
    document.head.appendChild(s);
}

ensureSocketIo(init);

// Main initializer (sets up voice client closure and UI handlers)
function init() {
    // --- Voice client closure (real-time PCM capture, downsample, playback) ---
    (function () {
        let socket = null;
        let audioCtx = null;
        let micStream = null;
        let sourceNode = null;
        let scriptNode = null;
        let workletNode = null;
        let heartbeatInterval = null;
        let zeroGain = null;
        let isRecording = false;
        let currentSessionId = null;
        let accessToken = localStorage.getItem('accessToken') || null;

        function getUserIdFromToken(token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                return payload.userId || payload.id || payload.sub || 'unknown-user';
            } catch (err) {
                return 'unknown-user';
            }
        }

        // --- UI helpers available inside closure (fixes updateStatus ReferenceError) ---
        function updateStatus(text, status) {
            // Try to update DOM elements if present
            try {
                const statusTextEl = document.getElementById('statusText');
                const statusIndicatorEl = document.getElementById('statusIndicator');
                if (statusTextEl) statusTextEl.textContent = text;
                if (statusIndicatorEl) statusIndicatorEl.className = `status-indicator ${status}`;
            } catch (e) {
                /* ignore - no DOM available */
            }
            // Also log for debugging
            console.info('[voice-test] status:', text, status);
        }

        function addMessage(text, type = 'system', sender = '') {
            try {
                const chatArea = document.getElementById('chatArea');
                if (!chatArea) {
                    console.log('[voice-test] message:', text);
                    return;
                }
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${type}`;
                if (sender) {
                    const senderDiv = document.createElement('div');
                    senderDiv.className = 'sender';
                    senderDiv.textContent = sender;
                    messageDiv.appendChild(senderDiv);
                }
                const textDiv = document.createElement('div');
                textDiv.textContent = text;
                messageDiv.appendChild(textDiv);
                chatArea.appendChild(messageDiv);
                chatArea.scrollTop = chatArea.scrollHeight;
            } catch (e) {
                console.log('[voice-test] addMessage fallback:', text);
            }
        }

        function setupSocketListeners() {
            if (!socket) return;
            socket.on('connect', () => {
                updateStatus('Connected to voice service', 'connected');
            });

            socket.on('voice:connected', (data) => {
                addMessage('Voice session started! You can now speak.', 'system');
                document.getElementById('startVoiceBtn').disabled = true;
                document.getElementById('stopVoiceBtn').disabled = false;
                currentSessionId = data.sessionId;
                startMicrophoneRecording();
            });

            socket.on('voice:audio', (data) => {
                if (data && data.audio) {
                    playPCMBase64(data.audio);
                }
            });

            socket.on('voice:user-transcript', (d) => addMessage(d.transcript, 'user', 'You'));

            // Map of interim assistant messages keyed by responseId
            window.__voiceTest = window.__voiceTest || {};
            window.__voiceTest._interimAssistant = window.__voiceTest._interimAssistant || {};

            socket.on('voice:assistant-transcript', (data) => {
                console.log('Assistant transcript:', data);
                // If a responseId is provided we can update/replace the interim message
                const rid = data.responseId;

                if (rid) {
                    const existingId = `assistant-${rid}`;
                    const existingEl = document.querySelector(`[data-response-id="${rid}"]`);

                    if (!data.isFinal) {
                        // Interim update: create or update the interim bubble
                        if (existingEl) {
                            // update text content (skip sender line)
                            const textDiv = existingEl.querySelector('.assistant-text');
                            if (textDiv) textDiv.textContent = data.transcript;
                        } else {
                            // create new interim assistant bubble
                            const msg = document.createElement('div');
                            msg.className = 'message agent interim';
                            msg.setAttribute('data-response-id', rid);
                            // sender
                            const senderDiv = document.createElement('div');
                            senderDiv.className = 'sender';
                            senderDiv.textContent = 'Assistant';
                            msg.appendChild(senderDiv);
                            // text
                            const textDiv = document.createElement('div');
                            textDiv.className = 'assistant-text';
                            textDiv.textContent = data.transcript;
                            msg.appendChild(textDiv);
                            chatArea.appendChild(msg);
                            chatArea.scrollTop = chatArea.scrollHeight;
                        }
                    } else {
                        // Final - replace interim or add as normal message
                        if (existingEl) {
                            existingEl.className = 'message agent';
                            const textDiv = existingEl.querySelector('.assistant-text');
                            if (textDiv) textDiv.textContent = data.transcript;
                        } else {
                            addMessage(data.transcript, 'agent', 'Assistant');
                        }
                    }
                } else {
                    // No responseId provided - fallback to previous behavior
                    if (data.isFinal) {
                        addMessage(data.transcript, 'agent', 'Assistant');
                    }
                }
            });

            socket.on('voice:session-ended', () => stopVoiceSession());
            socket.on('voice:error', (err) => addMessage('Error: ' + (err.error || err.message || 'Unknown'), 'system'));
        }

        async function startVoiceSession() {
            updateStatus('Connecting to voice service...', 'connecting');
            accessToken = localStorage.getItem('accessToken') || accessToken;

            socket = io(`${API_BASE}/voice`, {
                auth: { token: accessToken },
                transports: ['websocket']
            });

            // Debugging: show connection errors returned by server middleware
            socket.on('connect_error', (err) => {
                console.error('Socket connect_error:', err);
                addMessage('Socket connect error: ' + (err?.message || err), 'system');
                updateStatus('Disconnected', 'disconnected');
            });

            socket.on('connect_timeout', () => {
                console.warn('Socket connect_timeout');
                addMessage('Socket connection timed out', 'system');
                updateStatus('Disconnected', 'disconnected');
            });

            socket.on('reconnect_failed', () => {
                console.warn('Socket reconnect_failed');
                addMessage('Socket reconnect failed', 'system');
                updateStatus('Disconnected', 'disconnected');
            });

            socket.on('error', (err) => {
                console.error('Socket error:', err);
            });

            setupSocketListeners();

            currentSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

            socket.emit('voice:connect', {
                userId: getUserIdFromToken(accessToken),
                sessionId: currentSessionId,
                userPreferences: {
                    voicePreference: document.getElementById('voiceSelect').value
                }
            });
        }

        function stopVoiceSession() {
            if (socket) {
                socket.emit('voice:disconnect', { sessionId: currentSessionId });
                socket.disconnect();
                socket = null;
            }
            stopMicrophoneRecording();
            updateStatus('Voice session ended', 'disconnected');
            document.getElementById('startVoiceBtn').disabled = false;
            document.getElementById('stopVoiceBtn').disabled = true;
            currentSessionId = null;
        }

        // Audio capture: downsample & send to backend (24000 Hz, 16-bit PCM)
        // Updated startMicrophoneRecording: prefer AudioWorklet, fallback to ScriptProcessor
        async function startMicrophoneRecording() {
            if (isRecording) return;
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
                });

                // Create audio context and resume on user gesture
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                await audioCtx.resume();

                micStream = stream;
                sourceNode = audioCtx.createMediaStreamSource(stream);
                zeroGain = audioCtx.createGain();
                zeroGain.gain.value = 0;

                // Try AudioWorklet if available
                let usingWorklet = false;
                try {
                    if (audioCtx.audioWorklet) {
                        await audioCtx.audioWorklet.addModule('audio-processor.js');
                        workletNode = new AudioWorkletNode(audioCtx, 'audio-processor');

                        workletNode.port.onmessage = (event) => {
                            try {
                                const floatBuffer = new Float32Array(event.data);
                                // Downsample to 24kHz if needed
                                const down = downsampleBuffer(floatBuffer, audioCtx.sampleRate, 24000);
                                if (!down || down.length === 0) return;
                                const int16 = floatTo16BitPCM(down);
                                const base64 = arrayBufferToBase64(int16.buffer);
                                if (socket && socket.connected) {
                                    socket.emit('voice:audio', {
                                        audio: base64,
                                        timestamp: Date.now(),
                                        sessionId: currentSessionId
                                    });
                                    console.debug('[voice-test] sent audio chunk (bytes):', int16.byteLength);
                                }
                            } catch (e) {
                                console.error('[voice-test] worklet onmessage error', e);
                            }
                        };

                        // Connect through worklet -> silent output to keep audio graph alive
                        sourceNode.connect(workletNode);
                        workletNode.connect(zeroGain);
                        zeroGain.connect(audioCtx.destination);
                        usingWorklet = true;
                        addMessage('🎧 Microphone active (AudioWorklet) - start speaking!', 'system');
                    }
                } catch (e) {
                    console.warn('[voice-test] AudioWorklet not available or failed to load, falling back to ScriptProcessor', e);
                }

                // Fallback to ScriptProcessor if worklet not available
                if (!usingWorklet) {
                    scriptNode = audioCtx.createScriptProcessor(4096, 1, 1);
                    scriptNode.onaudioprocess = (event) => {
                        const input = event.inputBuffer.getChannelData(0);
                        const down = downsampleBuffer(input, audioCtx.sampleRate, 24000);
                        if (!down || down.length === 0) return;
                        const int16 = floatTo16BitPCM(down);
                        const base64 = arrayBufferToBase64(int16.buffer);
                        if (socket && socket.connected) {
                            socket.emit('voice:audio', {
                                audio: base64,
                                timestamp: Date.now(),
                                sessionId: currentSessionId
                            });
                            console.debug('[voice-test] sent audio chunk (bytes):', int16.byteLength);
                        }
                    };
                    sourceNode.connect(scriptNode);
                    scriptNode.connect(zeroGain);
                    zeroGain.connect(audioCtx.destination);
                    addMessage('🎧 Microphone active (ScriptProcessor fallback) - start speaking!', 'system');
                }

                isRecording = true;
                updateStatus('Microphone active', 'connected');

                // Start heartbeat when recording/connected (guarded by having sessionId)
                if (!heartbeatInterval && currentSessionId) {
                    heartbeatInterval = setInterval(() => {
                        if (socket && socket.connected && currentSessionId) {
                            socket.emit('voice:heartbeat', { sessionId: currentSessionId });
                        }
                    }, 20000);
                }
            } catch (error) {
                addMessage('Microphone access failed: ' + (error.message || error), 'system');
                console.error('[voice-test] startMicrophoneRecording failed', error);
            }
        }

        function stopMicrophoneRecording() {
            try {
                if (scriptNode) { scriptNode.disconnect(); scriptNode.onaudioprocess = null; scriptNode = null; }
                if (workletNode) { try { workletNode.port.postMessage({ type: 'stop' }); } catch (e) { } workletNode.disconnect(); workletNode = null; }
                if (sourceNode) { sourceNode.disconnect(); sourceNode = null; }
                if (zeroGain) { zeroGain.disconnect(); zeroGain = null; }
                if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
                if (audioCtx) { audioCtx.close(); audioCtx = null; }
            } catch (e) { /* ignore */ }
            isRecording = false;

            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
                heartbeatInterval = null;
            }
        }

        // Helpers: downsample, conversions, playback
        function downsampleBuffer(buffer, inputRate, outputRate) {
            if (outputRate === inputRate) return buffer.slice(0);
            if (outputRate > inputRate) return null;
            const ratio = inputRate / outputRate;
            const newLen = Math.round(buffer.length / ratio);
            const res = new Float32Array(newLen);
            let offRes = 0, offBuf = 0;
            while (offRes < newLen) {
                const next = Math.round((offRes + 1) * ratio);
                let acc = 0, cnt = 0;
                for (let i = offBuf; i < next && i < buffer.length; i++) { acc += buffer[i]; cnt++; }
                res[offRes] = cnt ? acc / cnt : 0;
                offRes++; offBuf = next;
            }
            return res;
        }

        function floatTo16BitPCM(float32Array) {
            const l = float32Array.length;
            const buffer = new ArrayBuffer(l * 2);
            const view = new DataView(buffer);
            let offset = 0;
            for (let i = 0; i < l; i++, offset += 2) {
                let s = Math.max(-1, Math.min(1, float32Array[i]));
                view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            }
            return new Int16Array(buffer);
        }

        function arrayBufferToBase64(buffer) {
            const bytes = new Uint8Array(buffer);
            let binary = '';
            const chunk = 0x8000;
            for (let i = 0; i < bytes.length; i += chunk) {
                const sub = bytes.subarray(i, i + chunk);
                binary += String.fromCharCode.apply(null, sub);
            }
            return btoa(binary);
        }

        function playPCMBase64(base64) {
            try {
                const binary = atob(base64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                const int16 = new Int16Array(bytes.buffer);
                const float32 = Int16ToFloat32(int16);
                const ctx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
                const buffer = ctx.createBuffer(1, float32.length, 24000);
                buffer.getChannelData(0).set(float32);
                const src = ctx.createBufferSource();
                src.buffer = buffer;
                src.connect(ctx.destination);
                src.start();
            } catch (e) {
                console.error('Playback failed', e);
            }
        }

        function Int16ToFloat32(int16Array) {
            const l = int16Array.length;
            const out = new Float32Array(l);
            for (let i = 0; i < l; i++) out[i] = int16Array[i] / 32768;
            return out;
        }

        // expose minimal API
        window.__voiceTest = { start: startVoiceSession, stop: stopVoiceSession, play: playPCMBase64, API_BASE };
    })();

    // --- UI, auth and event binding (runs after DOM content is ready) ---
    document.addEventListener('DOMContentLoaded', () => {
        console.info('[voice-test.js] DOM ready, binding UI handlers');
        const authSection = document.getElementById('authSection');
        const chatSection = document.getElementById('chatSection');
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        const chatArea = document.getElementById('chatArea');

        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('signupForm');
        const otpForm = document.getElementById('otpForm');
        const authError = document.getElementById('authError');

        const startVoiceBtn = document.getElementById('startVoiceBtn');
        const stopVoiceBtn = document.getElementById('stopVoiceBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const showSignup = document.getElementById('showSignup');
        const backToLogin = document.getElementById('backToLogin');
        const backToSignup = document.getElementById('backToSignup');

        function showAuthInterface() { authSection.classList.remove('hidden'); chatSection.classList.add('hidden'); showLoginForm(); }
        function showChatInterface() { authSection.classList.add('hidden'); chatSection.classList.remove('hidden'); }
        function showLoginForm() { loginForm.classList.remove('hidden'); signupForm.classList.add('hidden'); otpForm.classList.add('hidden'); authError.classList.add('hidden'); }
        function showSignupForm() { loginForm.classList.add('hidden'); signupForm.classList.remove('hidden'); otpForm.classList.add('hidden'); authError.classList.add('hidden'); }
        function showOTPForm(email) { document.getElementById('signupEmail').value = email; signupForm.classList.add('hidden'); otpForm.classList.remove('hidden'); authError.classList.add('hidden'); }
        function showAuthError(message) { authError.textContent = message; authError.classList.remove('hidden'); }
        function updateStatus(text, status) { statusText.textContent = text; statusIndicator.className = `status-indicator ${status}`; }
        function addMessage(text, type = 'system', sender = '') {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${type}`;
            if (sender) { const senderDiv = document.createElement('div'); senderDiv.className = 'sender'; senderDiv.textContent = sender; messageDiv.appendChild(senderDiv); }
            const textDiv = document.createElement('div'); textDiv.textContent = text; messageDiv.appendChild(textDiv);
            chatArea.appendChild(messageDiv); chatArea.scrollTop = chatArea.scrollHeight;
        }

        // Bind auth form handlers
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            try {
                const resp = await fetch(`${API_BASE}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await resp.json();
                if (data.success) {
                    localStorage.setItem('accessToken', data.data.accessToken);
                    showChatInterface();
                    updateStatus('Authenticated', 'connected');
                } else {
                    showAuthError(data.message || 'Login failed');
                }
            } catch (err) {
                showAuthError('Login failed: ' + (err.message || err));
            }
        });

        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('signupName').value;
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            try {
                const resp = await fetch(`${API_BASE}/api/auth/signup-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });
                const data = await resp.json();
                if (data.success) showOTPForm(email); else showAuthError(data.message);
            } catch (err) { showAuthError('Signup failed: ' + (err.message || err)); }
        });

        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('signupEmail').value;
            const otpCode = document.getElementById('otpCode').value;
            try {
                const resp = await fetch(`${API_BASE}/api/auth/verify-otp-registration`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, otpCode })
                });
                const data = await resp.json();
                if (data.success) {
                    const password = document.getElementById('signupPassword').value;
                    // Auto-login after verification
                    const loginResp = await fetch(`${API_BASE}/api/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                    });
                    const loginData = await loginResp.json();
                    if (loginData.success) {
                        localStorage.setItem('accessToken', loginData.data.accessToken);
                        showChatInterface();
                        updateStatus('Authenticated', 'connected');
                    } else {
                        showAuthError(loginData.message || 'Login failed after verification');
                    }
                } else showAuthError(data.message);
            } catch (err) { showAuthError('OTP verification failed: ' + (err.message || err)); }
        });

        showSignup.addEventListener('click', (e) => { e.preventDefault(); showSignupForm(); });
        backToLogin.addEventListener('click', showLoginForm);
        backToSignup.addEventListener('click', showSignupForm);

        // Voice control bindings
        startVoiceBtn.addEventListener('click', () => {
            if (window.__voiceTest && window.__voiceTest.start) window.__voiceTest.start();
            updateStatus('Connecting to voice service...', 'connecting');
        });

        stopVoiceBtn.addEventListener('click', () => {
            if (window.__voiceTest && window.__voiceTest.stop) window.__voiceTest.stop();
            updateStatus('Voice session ended', 'disconnected');
        });

        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('accessToken');
            showAuthInterface();
            updateStatus('Logged out', 'disconnected');
        });

        // On load, check token/auth status
        (async function checkAuth() {
            const token = localStorage.getItem('accessToken');
            if (token) {
                try {
                    const r = await fetch(`${API_BASE}/api/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } });
                    if (r.ok) { showChatInterface(); updateStatus('Authenticated', 'connected'); return; }
                } catch (e) { /* ignore */ }
                localStorage.removeItem('accessToken');
            }
            showAuthInterface();
        })();

        // Expose some helpers to the window console for debugging
        window.voiceTestHelpers = { addMessage, updateStatus, API_BASE };
    });
} // end init()

