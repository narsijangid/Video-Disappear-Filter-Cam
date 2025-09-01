class InvisibilityCamera {
            constructor() {
                this.video = null;
                this.canvas = null;
                this.ctx = null;
                this.stream = null;
                this.backgroundImageData = null;
                this.filterActive = false;
                this.recording = false;
                this.paused = false;
                this.mediaRecorder = null;
                this.recordedChunks = [];
                this.animationId = null;
                this.recordingStartTime = null;
                this.recordingTimer = null;
                this.totalPausedTime = 0;
                this.pauseStartTime = null;
                this.currentColorPreset = 'green';
                
                this.colorPresets = {
                    green: { hueMin: 40, hueMax: 80, satMin: 82, satMax: 255, valMin: 78, valMax: 255 },
                    blue: { hueMin: 100, hueMax: 130, satMin: 50, satMax: 255, valMin: 50, valMax: 255 },
                    red: { hueMin: 0, hueMax: 10, satMin: 50, satMax: 255, valMin: 50, valMax: 255 },
                    orange: { hueMin: 10, hueMax: 25, satMin: 100, satMax: 255, valMin: 100, valMax: 255 },
                    pink: { hueMin: 140, hueMax: 170, satMin: 50, satMax: 255, valMin: 100, valMax: 255 },
                    purple: { hueMin: 120, hueMax: 140, satMin: 50, satMax: 255, valMin: 50, valMax: 255 },
                    yellow: { hueMin: 20, hueMax: 35, satMin: 100, satMax: 255, valMin: 100, valMax: 255 },
                    custom: { hueMin: 40, hueMax: 80, satMin: 82, satMax: 255, valMin: 78, valMax: 255 }
                };
                
                this.colorRange = { ...this.colorPresets.green };
            }

            async initialize() {
                try {
                    this.video = document.getElementById('video');
                    this.canvas = document.getElementById('output');
                    this.ctx = this.canvas.getContext('2d');

                    // Request camera with ideal mobile specs
                    this.stream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            facingMode: 'user',
                            width: { ideal: window.innerWidth },
                            height: { ideal: window.innerHeight }
                        },
                        audio: true
                    });

                    this.video.srcObject = this.stream;
                    
                    this.video.addEventListener('loadedmetadata', () => {
                        this.canvas.width = this.video.videoWidth;
                        this.canvas.height = this.video.videoHeight;
                        this.hidePermissionOverlay();
                        this.showStatus('Tap the camera button to capture background', 2000);
                    });

                } catch (error) {
                    this.showStatus('Camera access denied. Please allow camera permission.', 5000);
                    console.error('Camera error:', error);
                }
            }

            hidePermissionOverlay() {
                document.getElementById('permissionOverlay').style.display = 'none';
            }

            showStatus(message, duration = 3000) {
                const overlay = document.getElementById('statusOverlay');
                const messageEl = document.getElementById('statusMessage');
                messageEl.textContent = message;
                overlay.classList.add('show');
                
                setTimeout(() => {
                    overlay.classList.remove('show');
                }, duration);
            }

            captureBackground() {
                if (!this.stream) return;

                let countdown = 3;
                this.showStatus(`Capturing background in ${countdown}... Move out of frame!`, 1000);
                
                const countdownInterval = setInterval(() => {
                    countdown--;
                    if (countdown > 0) {
                        this.showStatus(`Capturing background in ${countdown}... Move out of frame!`, 1000);
                    } else {
                        clearInterval(countdownInterval);
                        
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = this.video.videoWidth;
                        tempCanvas.height = this.video.videoHeight;
                        const tempCtx = tempCanvas.getContext('2d');
                        
                        tempCtx.drawImage(this.video, 0, 0);
                        this.backgroundImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                        
                        this.showStatus('Background captured! Ready to record!', 2000);
                        document.getElementById('headerText').textContent = 'Background captured! Start recording now';
                        
                        this.startFilter();
                    }
                }, 1000);
            }

            startFilter() {
                if (!this.backgroundImageData) return;
                
                this.filterActive = true;
                this.processFrames();
            }

            processFrames() {
                if (!this.filterActive || !this.stream) return;

                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = this.video.videoWidth;
                tempCanvas.height = this.video.videoHeight;
                const tempCtx = tempCanvas.getContext('2d');
                
                tempCtx.drawImage(this.video, 0, 0);
                const currentFrame = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                
                const result = this.applyInvisibilityEffect(currentFrame, this.backgroundImageData);
                this.ctx.putImageData(result, 0, 0);
                
                this.animationId = requestAnimationFrame(() => this.processFrames());
            }

            applyInvisibilityEffect(currentFrame, background) {
                const width = currentFrame.width;
                const height = currentFrame.height;
                const current = currentFrame.data;
                const bg = background.data;
                
                const output = new ImageData(width, height);
                
                for (let i = 0; i < current.length; i += 4) {
                    const r = current[i];
                    const g = current[i + 1];
                    const b = current[i + 2];
                    
                    const hsv = this.rgbToHsv(r, g, b);
                    const h = hsv.h * 180;
                    const s = hsv.s * 255;
                    const v = hsv.v * 255;
                    
                    const isTargetColor = (h >= this.colorRange.hueMin && h <= this.colorRange.hueMax) &&
                                         (s >= this.colorRange.satMin && s <= this.colorRange.satMax) &&
                                         (v >= this.colorRange.valMin && v <= this.colorRange.valMax);
                    
                    if (isTargetColor) {
                        output.data[i] = bg[i];
                        output.data[i + 1] = bg[i + 1];
                        output.data[i + 2] = bg[i + 2];
                        output.data[i + 3] = 255;
                    } else {
                        output.data[i] = current[i];
                        output.data[i + 1] = current[i + 1];
                        output.data[i + 2] = current[i + 2];
                        output.data[i + 3] = 255;
                    }
                }
                
                return output;
            }

            rgbToHsv(r, g, b) {
                r /= 255;
                g /= 255;
                b /= 255;
                
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const diff = max - min;
                
                let h = 0;
                if (diff !== 0) {
                    if (max === r) h = ((g - b) / diff) % 6;
                    else if (max === g) h = (b - r) / diff + 2;
                    else h = (r - g) / diff + 4;
                }
                h /= 6;
                if (h < 0) h += 1;
                
                const s = max === 0 ? 0 : diff / max;
                const v = max;
                
                return { h, s, v };
            }

            toggleRecording() {
                if (!this.backgroundImageData) {
                    this.showStatus('Please capture background first!', 3000);
                    return;
                }

                if (!this.recording && !this.paused) {
                    // Start new recording
                    this.playRecordingStartSound();
                    this.startRecording();
                } else if (this.recording && !this.paused) {
                    // Pause recording
                    this.playRecordingStopSound();
                    this.pauseRecording();
                } else if (this.paused) {
                    // Resume recording
                    this.playRecordingStartSound();
                    this.resumeRecording();
                }
            }

            startRecording() {
                try {
                    const canvasStream = this.canvas.captureStream(30);
                    const audioTrack = this.stream.getAudioTracks()[0];
                    
                    if (audioTrack) {
                        canvasStream.addTrack(audioTrack);
                    }

                    this.mediaRecorder = new MediaRecorder(canvasStream, {
                        mimeType: 'video/webm;codecs=vp9'
                    });

                    this.recordedChunks = [];

                    this.mediaRecorder.ondataavailable = (event) => {
                        if (event.data.size > 0) {
                            this.recordedChunks.push(event.data);
                        }
                    };

                    this.mediaRecorder.onstop = () => {
                        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
                        this.videoBlob = blob;
                        this.showDownloadSection();
                    };

                    this.mediaRecorder.start();
                    this.recording = true;
                    this.recordingStartTime = Date.now();
                    
                    this.updateRecordingUI();
                    this.startRecordingTimer();
                    
                } catch (error) {
                    this.showStatus('❌ Recording failed: ' + error.message, 3000);
                }
            }

            pauseRecording() {
                if (this.mediaRecorder && this.recording) {
                    this.mediaRecorder.stop();
                    this.recording = false;
                    this.paused = true;
                    this.pauseStartTime = Date.now();
                    this.stopRecordingTimer();
                    this.updateRecordingUI();
                }
            }

            discardRecording() {
                this.recordedChunks = [];
                this.videoBlob = null;
                this.recording = false;
                this.paused = false;
                this.totalPausedTime = 0;
                this.pauseStartTime = null;
                this.stopRecordingTimer();
                this.updateRecordingUI();
                this.hideDownloadSection();
                this.showStatus('Recording discarded', 2000);
            }

            finishRecording() {
                if (this.mediaRecorder && this.recording) {
                    this.pauseRecording();
                }
            }

            resumeRecording() {
                if (!this.paused) return;
                
                try {
                    const canvasStream = this.canvas.captureStream(30);
                    const audioTrack = this.stream.getAudioTracks()[0];
                    
                    if (audioTrack) {
                        canvasStream.addTrack(audioTrack);
                    }

                    this.mediaRecorder = new MediaRecorder(canvasStream, {
                        mimeType: 'video/webm;codecs=vp9'
                    });

                    this.mediaRecorder.ondataavailable = (event) => {
                        if (event.data.size > 0) {
                            this.recordedChunks.push(event.data);
                        }
                    };

                    this.mediaRecorder.onstop = () => {
                        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
                        this.videoBlob = blob;
                        this.showDownloadSection();
                    };

                    this.mediaRecorder.start();
                    this.recording = true;
                    this.paused = false;
                    
                    if (this.pauseStartTime) {
                        this.totalPausedTime += Date.now() - this.pauseStartTime;
                        this.pauseStartTime = null;
                    }
                    
                    this.updateRecordingUI();
                    this.startRecordingTimer();
                    
                } catch (error) {
                    this.showStatus('❌ Resume failed: ' + error.message, 3000);
                }
            }

            updateRecordingUI() {
                const recordBtn = document.getElementById('recordBtn');
                const discardBtn = document.getElementById('discardBtn');
                const doneBtn = document.getElementById('doneBtn');
                const indicator = document.getElementById('recordingIndicator');

                if (this.recording) {
                    recordBtn.innerHTML = '<i class="bi bi-pause-circle-fill"></i>';
                    recordBtn.classList.add('recording');
                    discardBtn.style.display = 'flex';
                    doneBtn.style.display = 'flex';
                    indicator.classList.add('show');
                } else if (this.paused) {
                    recordBtn.innerHTML = '<i class="bi bi-play-circle-fill"></i>';
                    recordBtn.classList.remove('recording');
                    discardBtn.style.display = 'flex';
                    doneBtn.style.display = 'flex';
                    indicator.classList.remove('show');
                } else {
                    recordBtn.innerHTML = '<i class="bi bi-record-circle"></i>';
                    recordBtn.classList.remove('recording');
                    discardBtn.style.display = 'none';
                    doneBtn.style.display = 'none';
                    indicator.classList.remove('show');
                }
            }

            startRecordingTimer() {
                this.recordingTimer = setInterval(() => {
                    if (this.recordingStartTime) {
                        const elapsed = Date.now() - this.recordingStartTime - this.totalPausedTime;
                        const minutes = Math.floor(elapsed / 60000);
                        const seconds = Math.floor((elapsed % 60000) / 1000);
                        document.getElementById('recordingTime').textContent = 
                            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                    }
                }, 1000);
            }

            stopRecordingTimer() {
                if (this.recordingTimer) {
                    clearInterval(this.recordingTimer);
                    this.recordingTimer = null;
                }
            }

            showDownloadSection() {
                document.getElementById('downloadSection').classList.add('show');
                this.playClickSound();
            }

            hideDownloadSection() {
                document.getElementById('downloadSection').classList.remove('show');
            }

            playClickSound() {
                // Create a professional click sound using Web Audio API
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
                oscillator.type = 'triangle';
                
                gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.08);
            }

            playRecordingSound() {
                // Create a professional recording sound
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
                oscillator.type = 'sine';
                
                gainNode.gain.setValueAtTime(0.03, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.15);
            }

            playEntrySound() {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.type = 'triangle';
                oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.3);
                gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.3);
            }

            playRecordingStartSound() {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.type = 'square';
                oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.1);
            }

            playRecordingStopSound() {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.15);
            }

            playDownloadSound() {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
                oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1);
                oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2);
                gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.4);
            }

            downloadVideo() {
                if (!this.videoBlob) return;

                this.playDownloadSound();
                const url = URL.createObjectURL(this.videoBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `invisibility_video_${new Date().getTime()}.webm`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                this.hideDownloadSection();
                this.showStatus('Video downloaded successfully!', 3000);
            }

            selectColor(colorName) {
                this.currentColorPreset = colorName;
                
                // Update UI
                document.querySelectorAll('.color-option').forEach(option => {
                    option.classList.remove('active');
                });
                document.querySelector(`[data-color="${colorName}"]`).classList.add('active');

                // Update color range
                if (colorName !== 'custom') {
                    this.colorRange = { ...this.colorPresets[colorName] };
                }

                // Show/hide custom controls
                const customControls = document.getElementById('customControls');
                if (colorName === 'custom') {
                    customControls.classList.add('show');
                } else {
                    customControls.classList.remove('show');
                }

                const colorNames = {
                    green: 'green items',
                    blue: 'blue items',
                    red: 'red items',
                    custom: 'custom colored items'
                };

                document.getElementById('headerText').textContent = 
                    this.backgroundImageData ? 
                    `Hold ${colorNames[colorName]} to become invisible!` : 
                    'Capture background first, then start recording!';
            }

            updateCustomColor() {
                if (this.currentColorPreset !== 'custom') return;

                this.colorRange.hueMin = parseInt(document.getElementById('hueMin').value);
                this.colorRange.hueMax = parseInt(document.getElementById('hueMax').value);
                this.colorRange.satMin = parseInt(document.getElementById('satMin').value);
                this.colorRange.satMax = parseInt(document.getElementById('satMax').value);
                this.colorRange.valMin = parseInt(document.getElementById('valMin').value);
                this.colorRange.valMax = parseInt(document.getElementById('valMax').value);
                
                document.getElementById('hueMinVal').textContent = this.colorRange.hueMin;
                document.getElementById('hueMaxVal').textContent = this.colorRange.hueMax;
                document.getElementById('satMinVal').textContent = this.colorRange.satMin;
                document.getElementById('satMaxVal').textContent = this.colorRange.satMax;
                document.getElementById('valMinVal').textContent = this.colorRange.valMin;
                document.getElementById('valMaxVal').textContent = this.colorRange.valMax;
            }

            toggleSettings() {
                const panel = document.getElementById('sidePanel');
                panel.classList.toggle('open');
            }

            stop() {
                this.filterActive = false;
                this.recording = false;
                
                if (this.animationId) {
                    cancelAnimationFrame(this.animationId);
                    this.animationId = null;
                }
                
                if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                    this.mediaRecorder.stop();
                }
                
                if (this.stream) {
                    this.stream.getTracks().forEach(track => track.stop());
                    this.stream = null;
                }
                
                this.stopRecordingTimer();
                this.updateRecordingUI();
            }
        }

        // Global app instance
        let app = new InvisibilityCamera();

        // Global functions for HTML events
        async function initializeCamera() {
            app.playEntrySound();
            await app.initialize();
        }

        function captureBackground() {
            app.playClickSound();
            app.captureBackground();
        }

        function toggleRecording() {
            app.playClickSound();
            app.toggleRecording();
        }

        function discardRecording() {
            app.playClickSound();
            app.discardRecording();
        }

        function finishRecording() {
            app.playClickSound();
            app.finishRecording();
        }

        function downloadVideo() {
            app.playClickSound();
            app.downloadVideo();
        }

        function selectColor(color) {
            app.playClickSound();
            app.selectColor(color);
        }

        function updateCustomColor() {
            app.playClickSound();
            app.updateCustomColor();
        }

        function toggleSettings() {
            app.playClickSound();
            app.toggleSettings();
        }

        function closeDownloadPopup() {
            app.playClickSound();
            app.hideDownloadSection();
        }

        // Handle orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                if (app.canvas && app.video) {
                    app.canvas.width = app.video.videoWidth;
                    app.canvas.height = app.video.videoHeight;
                }
            }, 100);
        });

        // Close download popup on overlay click
        document.getElementById('downloadSection').addEventListener('click', (e) => {
            if (e.target.id === 'downloadSection') {
                closeDownloadPopup();
            }
        });

        // Handle page unload
        window.addEventListener('beforeunload', () => {
            app.stop();
        });

        // Prevent zoom on mobile
        document.addEventListener('gesturestart', function (e) {
            e.preventDefault();
        });

        // Close settings panel when tapping outside
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('sidePanel');
            const settingsBtn = document.querySelector('.settings-btn');
            
            if (!panel.contains(e.target) && !settingsBtn.contains(e.target)) {
                panel.classList.remove('open');
            }
        });