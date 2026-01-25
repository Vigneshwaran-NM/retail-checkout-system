// ============================================
// OFFLINE VOICE-GUIDED BILLING
// ============================================

class VoiceBillingSystem {
    constructor() {
        this.isListening = false;
        this.recognition = null;
        this.commandHistory = [];
        this.maxHistory = 10;
        this.audioContext = null;
        
        // Command patterns
        this.commandPatterns = {
            // Add items: "add 1001 times 2", "add biscuit pack", "add two chocolate bars"
            addItem: /(?:add|insert|put)\s+([a-z0-9\s]+?)(?:\s+times\s+|\s+x\s+|\s*)(\d+)?/i,
            
            // Remove items: "remove chocolate", "delete biscuit pack"
            removeItem: /(?:remove|delete|take out)\s+([a-z0-9\s]+)/i,
            
            // Discount: "discount 10 percent", "20 rupees discount", "apply 15% discount"
            applyDiscount: /(?:discount|off|deduction)\s+(\d+)\s*(percent|%|rupees?|rs?)/i,
            
            // Clear discount: "clear discount", "remove discount"
            clearDiscount: /clear\s+discount|remove\s+discount/i,
            
            // Generate bill: "generate bill", "print bill", "create invoice"
            generateBill: /(?:generate|print|create)\s+(?:bill|invoice|receipt)/i,
            
            // Show cart: "show cart", "what's in cart", "list items"
            showCart: /(?:show|display|list)\s+(?:cart|items|products)/i,
            
            // Clear cart: "clear cart", "empty cart"
            clearCart: /clear\s+cart|empty\s+cart/i,
            
            // Search: "search biscuit", "find chocolate"
            searchProduct: /(?:search|find|look for)\s+([a-z0-9\s]+)/i,
            
            // Help: "help", "what can I say", "show commands"
            showHelp: /help|what can i say|show commands/i,
            
            // Stop: "stop listening", "exit voice mode"
            stopListening: /stop|exit|quit|end/i
        };
        
        // Initialize
        this.init();
    }
    
    init() {
        this.setupDOM();
        this.setupEventListeners();
        this.setupSpeechRecognition();
        this.setupAudioFeedback();
    }
    
    setupDOM() {
        // Create voice history container
        const historyContainer = document.createElement('div');
        historyContainer.className = 'voice-history';
        historyContainer.id = 'voiceHistory';
        historyContainer.innerHTML = `
            <h4>Voice Command History</h4>
            <div id="historyList"></div>
        `;
        document.body.appendChild(historyContainer);
        
        // Create voice feedback container
        const feedbackContainer = document.createElement('div');
        feedbackContainer.className = 'voice-feedback';
        feedbackContainer.id = 'voiceFeedback';
        document.body.appendChild(feedbackContainer);
    }
    
    setupEventListeners() {
        const voiceBtn = document.getElementById('voiceControlBtn');
        const voiceHelpBtn = document.getElementById('voiceHelpBtn');
        const startDemoBtn = document.getElementById('startVoiceDemo');
        const closeVoiceHelp = document.getElementById('closeVoiceHelp');
        
        if (voiceBtn) {
            voiceBtn.addEventListener('click', () => this.toggleListening());
        }
        
        if (voiceHelpBtn) {
            voiceHelpBtn.addEventListener('click', () => this.showHelp());
        }
        
        if (startDemoBtn) {
            startDemoBtn.addEventListener('click', () => this.startDemo());
        }
        
        if (closeVoiceHelp) {
            closeVoiceHelp.addEventListener('click', () => {
                document.getElementById('voiceHelpModal').style.display = 'none';
            });
        }
        
        // Keyboard shortcut: Ctrl+Space for voice
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.code === 'Space') {
                e.preventDefault();
                this.toggleListening();
            }
        });
    }
    
    setupSpeechRecognition() {
        // Check for browser support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.warn('Speech recognition not supported. Using fallback command parser.');
            this.showFeedback('Voice not supported', 'Using text command mode');
            return;
        }
        
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-IN'; // Indian English
        
        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateUI();
            this.showFeedback('Listening...', 'Speak your command');
        };
        
        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.toLowerCase();
            this.processCommand(transcript);
        };
        
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;
            this.updateUI();
            this.showFeedback('Error', 'Could not understand. Please try again.');
        };
        
        this.recognition.onend = () => {
            this.isListening = false;
            this.updateUI();
        };
    }
    
    setupAudioFeedback() {
        // Create audio context for beeps and feedback
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }
    
    playBeep(type = 'start') {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        if (type === 'start') {
            oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1200, this.audioContext.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.3);
        } else if (type === 'success') {
            oscillator.frequency.setValueAtTime(1200, this.audioContext.currentTime);
            oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.3);
        } else if (type === 'error') {
            oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.5);
        }
    }
    
    toggleListening() {
        if (!this.recognition) {
            this.showHelp();
            return;
        }
        
        if (this.isListening) {
            this.recognition.stop();
        } else {
            this.recognition.start();
            this.playBeep('start');
        }
    }
    
    updateUI() {
        const voiceBtn = document.getElementById('voiceControlBtn');
        const voiceStatus = document.getElementById('voiceStatus');
        const historyContainer = document.getElementById('voiceHistory');
        
        if (voiceBtn) {
            voiceBtn.classList.toggle('listening', this.isListening);
            voiceBtn.innerHTML = this.isListening ? 
                '<i class="fas fa-microphone-slash"></i><span>Stop Listening</span>' :
                '<i class="fas fa-microphone"></i><span>Voice Mode</span>';
        }
        
        if (voiceStatus) {
            voiceStatus.textContent = this.isListening ? 
                '🎤 Listening... Speak your command' :
                'Click microphone to start voice mode';
        }
        
        if (historyContainer && this.commandHistory.length > 0) {
            historyContainer.style.display = 'block';
        }
    }
    
    addToHistory(command, response) {
        const timestamp = new Date().toLocaleTimeString('en-IN', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
        
        this.commandHistory.unshift({
            command,
            response,
            timestamp,
            time: Date.now()
        });
        
        // Keep only recent history
        if (this.commandHistory.length > this.maxHistory) {
            this.commandHistory.pop();
        }
        
        // Update history display
        this.updateHistoryDisplay();
    }
    
    updateHistoryDisplay() {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;
        
        historyList.innerHTML = this.commandHistory.map(item => `
            <div class="voice-history-item">
                <span class="command">${item.command}</span>
                <span class="time">${item.timestamp}</span>
            </div>
            <div class="voice-history-item response">
                ${item.response}
            </div>
        `).join('');
    }
    
    showFeedback(title, message, type = 'info') {
        const feedback = document.getElementById('voiceFeedback');
        if (!feedback) return;
        
        let icon = 'fas fa-info-circle';
        if (type === 'success') icon = 'fas fa-check-circle';
        if (type === 'error') icon = 'fas fa-exclamation-circle';
        if (type === 'warning') icon = 'fas fa-exclamation-triangle';
        
        feedback.innerHTML = `
            <i class="${icon}"></i>
            <h3>${title}</h3>
            <p>${message}</p>
        `;
        
        feedback.style.display = 'block';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            feedback.style.display = 'none';
        }, 3000);
    }
    
    speakResponse(text) {
        // Use SpeechSynthesis API if available
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-IN';
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            
            // Try to use Indian English voice if available
            const voices = speechSynthesis.getVoices();
            const indianVoice = voices.find(voice => 
                voice.lang === 'en-IN' || voice.name.includes('India')
            );
            
            if (indianVoice) {
                utterance.voice = indianVoice;
            }
            
            speechSynthesis.speak(utterance);
        }
    }
    
    async processCommand(transcript) {
        console.log('Voice command:', transcript);
        this.addToHistory(transcript, 'Processing...');
        
        let response = '';
        let actionTaken = false;
        
        // Check each command pattern
        for (const [action, pattern] of Object.entries(this.commandPatterns)) {
            const match = transcript.match(pattern);
            if (match) {
                actionTaken = true;
                
                switch (action) {
                    case 'addItem':
                        response = await this.handleAddItem(match[1], match[2]);
                        break;
                        
                    case 'removeItem':
                        response = this.handleRemoveItem(match[1]);
                        break;
                        
                    case 'applyDiscount':
                        response = this.handleApplyDiscount(match[1], match[2]);
                        break;
                        
                    case 'clearDiscount':
                        response = this.handleClearDiscount();
                        break;
                        
                    case 'generateBill':
                        response = this.handleGenerateBill();
                        break;
                        
                    case 'showCart':
                        response = this.handleShowCart();
                        break;
                        
                    case 'clearCart':
                        response = this.handleClearCart();
                        break;
                        
                    case 'searchProduct':
                        response = await this.handleSearchProduct(match[1]);
                        break;
                        
                    case 'showHelp':
                        response = this.handleShowHelp();
                        break;
                        
                    case 'stopListening':
                        response = this.handleStopListening();
                        break;
                }
                
                break;
            }
        }
        
        if (!actionTaken) {
            response = "I didn't understand that command. Try saying 'help' for available commands.";
            this.showFeedback('Not Understood', 'Please try again', 'error');
            this.playBeep('error');
        } else {
            this.playBeep('success');
        }
        
        // Update history with response
        const historyItem = this.commandHistory[0];
        if (historyItem) {
            historyItem.response = response;
            this.updateHistoryDisplay();
        }
        
        // Speak the response
        this.speakResponse(response);
        
        return response;
    }
    
    async handleAddItem(itemText, quantity = '1') {
        const qty = parseInt(quantity) || 1;
        
        // Try to parse barcode (numeric)
        if (/^\d+$/.test(itemText.trim())) {
            // It's a barcode
            const barcode = itemText.trim();
            const product = await this.fetchProductByBarcode(barcode);
            
            if (product) {
                // Add to cart
                if (window.addProductToCart) {
                    window.addProductToCart(product, qty);
                    return `Added ${qty} ${product.name} to cart at ₹${product.price} each.`;
                }
                return `Found ${product.name} at ₹${product.price}.`;
            } else {
                return `Product with barcode ${barcode} not found.`;
            }
        } else {
            // It's a product name - search for it
            const products = await this.searchProductsByName(itemText);
            if (products.length > 0) {
                const product = products[0];
                if (window.addProductToCart) {
                    window.addProductToCart(product, qty);
                    return `Added ${qty} ${product.name} to cart at ₹${product.price} each.`;
                }
                return `Found ${product.name} at ₹${product.price}.`;
            } else {
                return `No product found matching "${itemText}".`;
            }
        }
    }
    
    handleRemoveItem(itemText) {
        // This would need access to the cart
        return `Remove functionality for "${itemText}" would be implemented here.`;
    }
    
    handleApplyDiscount(amount, type) {
        const discountAmount = parseInt(amount);
        
        if (type.includes('percent') || type === '%') {
            // Apply percentage discount
            if (window.document && window.document.querySelector) {
                const percentRadio = document.querySelector('input[name="discountType"][value="percent"]');
                const discountInput = document.getElementById('discountValue');
                const applyBtn = document.getElementById('applyDiscountBtn');
                
                if (percentRadio && discountInput && applyBtn) {
                    percentRadio.checked = true;
                    discountInput.value = discountAmount;
                    applyBtn.click();
                    return `Applied ${discountAmount} percent discount.`;
                }
            }
            return `Setting ${discountAmount} percent discount.`;
        } else {
            // Apply flat discount
            if (window.document && window.document.querySelector) {
                const flatRadio = document.querySelector('input[name="discountType"][value="flat"]');
                const discountInput = document.getElementById('discountValue');
                const applyBtn = document.getElementById('applyDiscountBtn');
                
                if (flatRadio && discountInput && applyBtn) {
                    flatRadio.checked = true;
                    discountInput.value = discountAmount;
                    applyBtn.click();
                    return `Applied flat discount of ₹${discountAmount}.`;
                }
            }
            return `Setting flat discount of ₹${discountAmount}.`;
        }
    }
    
    handleClearDiscount() {
        if (window.document && window.document.getElementById) {
            const clearBtn = document.getElementById('clearDiscountBtn');
            if (clearBtn) {
                clearBtn.click();
                return 'Discount cleared.';
            }
        }
        return 'Clearing discount.';
    }
    
    handleGenerateBill() {
        if (window.document && window.document.getElementById) {
            const generateBtn = document.getElementById('generateBillBtn');
            if (generateBtn) {
                generateBtn.click();
                return 'Generating and printing bill.';
            }
        }
        return 'Starting bill generation.';
    }
    
    handleShowCart() {
        if (window.cart && Array.isArray(window.cart)) {
            if (window.cart.length === 0) {
                return 'Cart is empty.';
            }
            
            const items = window.cart.map(item => 
                `${item.quantity} × ${item.name} at ₹${item.price} each`
            ).join(', ');
            
            const total = window.cart.reduce((sum, item) => 
                sum + (item.price * item.quantity), 0
            );
            
            return `Cart has ${window.cart.length} items: ${items}. Total is ₹${total.toFixed(2)}.`;
        }
        return 'Cart information not available.';
    }
    
    handleClearCart() {
        if (window.document && window.document.getElementById) {
            const clearBtn = document.getElementById('clearCartBtn');
            if (clearBtn) {
                if (confirm('Are you sure you want to clear the cart?')) {
                    clearBtn.click();
                    return 'Cart cleared.';
                }
                return 'Cart clear cancelled.';
            }
        }
        return 'Clearing cart.';
    }
    
    async handleSearchProduct(searchText) {
        const products = await this.searchProductsByName(searchText);
        
        if (products.length === 0) {
            return `No products found matching "${searchText}".`;
        } else if (products.length === 1) {
            return `Found ${products[0].name} at ₹${products[0].price}.`;
        } else {
            const names = products.slice(0, 3).map(p => p.name).join(', ');
            return `Found ${products.length} products including: ${names}.`;
        }
    }
    
    handleShowHelp() {
        document.getElementById('voiceHelpModal').style.display = 'flex';
        return 'Opening voice commands guide.';
    }
    
    handleStopListening() {
        if (this.isListening && this.recognition) {
            this.recognition.stop();
        }
        return 'Stopped listening. Voice mode is off.';
    }
    
    async fetchProductByBarcode(barcode) {
        try {
            const response = await fetch(`/api/products/${barcode}`);
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Error fetching product:', error);
        }
        return null;
    }
    
    async searchProductsByName(name) {
        try {
            const response = await fetch('/api/products');
            if (response.ok) {
                const allProducts = await response.json();
                const searchTerm = name.toLowerCase();
                return allProducts.filter(product => 
                    product.name.toLowerCase().includes(searchTerm)
                );
            }
        } catch (error) {
            console.error('Error searching products:', error);
        }
        return [];
    }
    
    showHelp() {
        document.getElementById('voiceHelpModal').style.display = 'flex';
    }
    
    startDemo() {
        const demoCommands = [
            "Add biscuit pack",
            "Add chocolate times 2",
            "Discount 10 percent",
            "Show cart",
            "Generate bill"
        ];
        
        let index = 0;
        const runNextCommand = () => {
            if (index < demoCommands.length) {
                this.showFeedback('Demo Mode', `Command: "${demoCommands[index]}"`, 'info');
                setTimeout(() => {
                    this.processCommand(demoCommands[index]);
                    index++;
                    setTimeout(runNextCommand, 2000);
                }, 1500);
            } else {
                this.showFeedback('Demo Complete', 'All commands demonstrated', 'success');
            }
        };
        
        this.showFeedback('Starting Demo', 'Voice commands demo starting...', 'info');
        runNextCommand();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.voiceBilling = new VoiceBillingSystem();
});