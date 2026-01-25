// ============================================
// RETAIL CHECKOUT SYSTEM - MAIN APP LOGIC
// ============================================

// ---------- GLOBAL STATE & VARIABLES ----------
let cart = []; // Array of {id, barcode, name, price, quantity}
let appliedDiscount = { type: null, value: 0 }; // 'flat' or 'percent'
let products = []; // Will be fetched from backend
let currentProduct = null; // Store the currently fetched product

// DOM Elements
const barcodeInput = document.getElementById('barcodeInput');
const fetchProductBtn = document.getElementById('fetchProductBtn');
const productDetails = document.getElementById('productDetails');
const productName = document.getElementById('productName');
const productPrice = document.getElementById('productPrice');
const quantityInput = document.getElementById('quantity');
const decreaseQtyBtn = document.getElementById('decreaseQty');
const increaseQtyBtn = document.getElementById('increaseQty');
const addToCartBtn = document.getElementById('addToCartBtn');
const cartItemsTable = document.getElementById('cartItems');
const emptyCartMessage = document.getElementById('emptyCartMessage');
const quickItemsContainer = document.getElementById('quickItems');
const discountTypeRadios = document.querySelectorAll('input[name="discountType"]');
const discountValueInput = document.getElementById('discountValue');
const applyDiscountBtn = document.getElementById('applyDiscountBtn');
const clearDiscountBtn = document.getElementById('clearDiscountBtn');
const appliedDiscountText = document.getElementById('appliedDiscountText');
const subtotalAmount = document.getElementById('subtotalAmount');
const discountAmount = document.getElementById('discountAmount');
const totalAmount = document.getElementById('totalAmount');
const clearCartBtn = document.getElementById('clearCartBtn');
const generateBillBtn = document.getElementById('generateBillBtn');
const billInsight = document.getElementById('billInsight');
const billModal = document.getElementById('billModal');
const billPreviewContent = document.getElementById('billPreviewContent');
const printBillBtn = document.getElementById('printBillBtn');
const closeBillBtn = document.getElementById('closeBillBtn');
const closeModalBtn = document.querySelector('.close-modal');
const currentDateTime = document.getElementById('currentDateTime');

function formatCurrency(amount) {
    return '₹' + new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function updateDateTime() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    };
    currentDateTime.textContent = now.toLocaleDateString('en-IN', options);
}

// Calculate cart totals
function calculateTotals() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let discount = 0;
    
    if (appliedDiscount.type === 'flat') {
        discount = Math.min(appliedDiscount.value, subtotal); // Cannot discount more than subtotal
    } else if (appliedDiscount.type === 'percent') {
        discount = subtotal * (appliedDiscount.value / 100);
    }
    
    const total = subtotal - discount;
    
    // Update UI
    subtotalAmount.textContent = formatCurrency(subtotal);
    discountAmount.textContent = formatCurrency(discount);
    totalAmount.textContent = formatCurrency(total);
    
    // Update discount text
    if (appliedDiscount.type) {
        const discountText = appliedDiscount.type === 'flat' 
            ? `₹${appliedDiscount.value}` 
            : `${appliedDiscount.value}%`;
        appliedDiscountText.textContent = discountText;
        appliedDiscountText.style.color = '#e74c3c';
    } else {
        appliedDiscountText.textContent = 'None';
        appliedDiscountText.style.color = '#7f8c8d';
    }
    
    return { subtotal, discount, total };
}

// ---------- PRODUCT & CART MANAGEMENT ----------
async function fetchProductByBarcode(barcode) {
    if (!barcode.trim()) {
        alert('Please enter a barcode or item code.');
        return null;
    }
    
    try {
        const response = await fetch(`/api/products/${barcode}`);
        if (!response.ok) {
            throw new Error('Product not found');
        }
        const product = await response.json();
        return product;
    } catch (error) {
        alert(`Product with code "${barcode}" not found. Please check and try again.`);
        return null;
    }
}

function displayProductDetails(product) {
    currentProduct = product; // Store the product globally
    productName.textContent = product.name;
    productPrice.textContent = product.price.toFixed(2);
    productDetails.style.display = 'block';
    quantityInput.value = 1;
    barcodeInput.value = ''; // Clear input after successful fetch
}

function addProductToCart(product, quantity) {
    // Check if product already exists in cart
    const existingIndex = cart.findIndex(item => item.id === product.id);
    
    if (existingIndex > -1) {
        // Update quantity if exists
        cart[existingIndex].quantity += quantity;
    } else {
        // Add new item to cart
        cart.push({
            id: product.id,
            barcode: product.barcode,
            name: product.name,
            price: product.price,
            quantity: quantity
        });
    }
    
    updateCartDisplay();
    calculateTotals();
    updateQuickAddPanel(); // Update quick add based on cart additions
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartDisplay();
    calculateTotals();
}

function updateCartItemQuantity(productId, newQuantity) {
    if (newQuantity < 1) {
        removeFromCart(productId);
        return;
    }
    
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity = newQuantity;
        updateCartDisplay();
        calculateTotals();
    }
}

function updateCartDisplay() {
    // Clear current cart display (except the empty message row)
    const rows = cartItemsTable.querySelectorAll('tr:not(#emptyCartMessage)');
    rows.forEach(row => row.remove());
    
    if (cart.length === 0) {
        emptyCartMessage.style.display = 'table-row';
        return;
    }
    
    emptyCartMessage.style.display = 'none';
    
    // Add each cart item as a table row
    cart.forEach(item => {
        const row = document.createElement('tr');
        const itemTotal = item.price * item.quantity;
        
        row.innerHTML = `
            <td class="cart-item-name">${item.name}</td>
            <td>${formatCurrency(item.price)}</td>
            <td>
                <div class="quantity-control">
                    <button class="qty-btn decrease-item" data-id="${item.id}">
                        <i class="fas fa-minus"></i>
                    </button>
                    <input type="number" class="item-quantity" value="${item.quantity}" min="1" data-id="${item.id}">
                    <button class="qty-btn increase-item" data-id="${item.id}">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            </td>
            <td>${formatCurrency(itemTotal)}</td>
            <td>
                <div class="cart-item-actions">
                    <button class="action-btn remove" data-id="${item.id}">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
            </td>
        `;
        
        cartItemsTable.appendChild(row);
    });
    
    // Add event listeners to dynamic buttons
    document.querySelectorAll('.decrease-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.closest('button').dataset.id);
            const item = cart.find(item => item.id === id);
            if (item) updateCartItemQuantity(id, item.quantity - 1);
        });
    });
    
    document.querySelectorAll('.increase-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.closest('button').dataset.id);
            const item = cart.find(item => item.id === id);
            if (item) updateCartItemQuantity(id, item.quantity + 1);
        });
    });
    
    document.querySelectorAll('.item-quantity').forEach(input => {
        input.addEventListener('change', (e) => {
            const id = parseInt(e.target.dataset.id);
            updateCartItemQuantity(id, parseInt(e.target.value));
        });
    });
    
    document.querySelectorAll('.action-btn.remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.closest('button').dataset.id);
            removeFromCart(id);
        });
    });
}

// ---------- PRINT BILL ----------
function printBill() {
    const printContent = billPreviewContent.innerHTML;
    const originalContent = document.body.innerHTML;
    
    // Create a print-friendly version
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print Bill - ${document.title}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .bill-header { text-align: center; margin-bottom: 20px; }
                .bill-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                .bill-table th, .bill-table td { padding: 8px; border-bottom: 1px solid #ddd; text-align: left; }
                .bill-table th { background-color: #f5f5f5; }
                .bill-totals { margin-top: 20px; border-top: 2px solid #000; padding-top: 10px; }
                .bill-footer { text-align: center; margin-top: 30px; color: #666; font-style: italic; }
                @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div style="padding: 20px;">
                ${printContent}
                <div class="no-print" style="text-align: center; margin-top: 30px;">
                    <button onclick="window.print()" style="padding: 10px 20px; background: #4a6491; color: white; border: none; border-radius: 5px; cursor: pointer;">Print Bill</button>
                    <button onclick="window.close()" style="padding: 10px 20px; background: #666; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">Close</button>
                </div>
            </div>
            <script>
                // Auto-print on load
                window.onload = function() {
                    window.print();
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
    
    // Keep the original page intact
    billModal.style.display = 'none';
}

// ---------- DISCOUNT MANAGEMENT ----------
function applyDiscount() {
    const discountValue = parseFloat(discountValueInput.value);
    const selectedType = document.querySelector('input[name="discountType"]:checked').value;
    
    if (isNaN(discountValue) || discountValue <= 0) {
        alert('Please enter a valid discount amount.');
        return;
    }
    
    appliedDiscount = { type: selectedType, value: discountValue };
    calculateTotals();
    discountValueInput.value = '';
    
    // Generate a simple insight
    generateBillInsight();
}

function clearDiscount() {
    appliedDiscount = { type: null, value: 0 };
    calculateTotals();
    discountValueInput.value = '';
    billInsight.innerHTML = '';
}

// ---------- QUICK ADD PANEL ----------
async function updateQuickAddPanel() {
    try {
        // Fetch frequently bought items (top 6 by sales)
        const response = await fetch('/api/sales/item-wise?limit=6');
        const frequentProducts = await response.json();
        
        quickItemsContainer.innerHTML = '';
        
        if (frequentProducts.length === 0) {
            // Fallback to all products if no sales data
            const allProductsResponse = await fetch('/api/products');
            const allProducts = await allProductsResponse.json();
            frequentProducts = allProducts.slice(0, 6);
        }
        
        frequentProducts.forEach(product => {
            const quickItem = document.createElement('button');
            quickItem.className = 'quick-item';
            quickItem.innerHTML = `
                <div class="quick-item-name">${product.name}</div>
                <div class="quick-item-price">${formatCurrency(product.price || product.total_value/product.total_quantity || 0)}</div>
                <div class="quick-item-stats">Sold: ${product.total_quantity || 0}</div>
            `;
            quickItem.addEventListener('click', async () => {
                // Fetch full product details by barcode
                const productResponse = await fetch(`/api/products/${product.barcode}`);
                if (productResponse.ok) {
                    const fullProduct = await productResponse.json();
                    currentProduct = fullProduct;
                    productName.textContent = fullProduct.name;
                    productPrice.textContent = fullProduct.price.toFixed(2);
                    productDetails.style.display = 'block';
                    quantityInput.value = 1;
                    quantityInput.focus();
                }
            });
            quickItemsContainer.appendChild(quickItem);
        });
    } catch (error) {
        console.error('Failed to load quick-add items:', error);
        quickItemsContainer.innerHTML = '<div class="loading">Unable to load frequent items</div>';
    }
}

// ---------- BILL INSIGHT GENERATION ----------
async function generateBillInsight() {
    if (cart.length === 0) {
        billInsight.innerHTML = '';
        return;
    }
    
    const { subtotal, discount, total } = calculateTotals();
    let insight = '';
    let icon = 'fas fa-lightbulb';
    let type = 'info'; // info, success, warning
    
    // Fetch today's sales data for comparison
    try {
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(`/api/sales/daily-summary?date=${today}`);
        const data = await response.json();
        const todaySales = data.summary.total_sales || 0;
        const todayBills = data.summary.total_bills || 0;
        
        // Rule-based insights with priority
        if (discount > 0 && discount > subtotal * 0.2) {
            insight = `High discount applied (${(discount/subtotal*100).toFixed(1)}%). Customer saved ${formatCurrency(discount)}!`;
            icon = 'fas fa-tag';
            type = 'success';
        } 
        else if (subtotal > 1000) {
            insight = `Large order (${formatCurrency(subtotal)})! Consider suggesting bulk pricing for future.`;
            icon = 'fas fa-chart-line';
            type = 'warning';
        }
        else if (cart.length >= 5) {
            insight = `Customer bought ${cart.length} different items. Might be stocking up.`;
            icon = 'fas fa-shopping-basket';
            type = 'info';
        }
        else if (todaySales > 0 && subtotal > todaySales/todayBills) {
            insight = `This bill is above today's average (${formatCurrency(todaySales/todayBills)})`;
            icon = 'fas fa-trend-up';
            type = 'success';
        }
        else {
            // Get best selling item for the day
            if (data.best_seller) {
                insight = `Today's best seller: ${data.best_seller.name} (${data.best_seller.total_quantity} sold)`;
                icon = 'fas fa-crown';
                type = 'info';
            } else {
                insight = 'Add a discount to encourage customer loyalty!';
                icon = 'fas fa-percentage';
                type = 'info';
            }
        }
        
        // Add comparison with yesterday if available
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const yesterdayResponse = await fetch(`/api/sales/daily-summary?date=${yesterdayStr}`);
        const yesterdayData = await yesterdayResponse.json();
        
        if (yesterdayData.summary.total_sales > 0) {
            const salesChange = ((todaySales - yesterdayData.summary.total_sales) / yesterdayData.summary.total_sales * 100);
            if (Math.abs(salesChange) > 10) {
                const changeText = salesChange > 0 ? 'increased' : 'decreased';
                insight += ` Sales ${changeText} by ${Math.abs(salesChange).toFixed(1)}% compared to yesterday.`;
            }
        }
        
    } catch (error) {
        console.error('Error generating insight:', error);
        // Fallback insights
        if (discount > 0) {
            insight = `Discount saved customer ${formatCurrency(discount)}`;
            icon = 'fas fa-tag';
            type = 'success';
        } else if (subtotal > 500) {
            insight = 'Consider offering a discount for orders above ₹500';
            icon = 'fas fa-comment-dollar';
            type = 'info';
        } else {
            insight = 'Add products to cart to see insights';
            icon = 'fas fa-info-circle';
            type = 'info';
        }
    }
    
    // Apply different styles based on insight type
    const typeClass = type === 'success' ? 'insight-success' : 
                     type === 'warning' ? 'insight-warning' : 'insight-info';
    
    billInsight.innerHTML = `
        <div class="bill-insight-content ${typeClass}">
            <i class="${icon}"></i>
            <div>
                <strong>Smart Insight:</strong> ${insight}
            </div>
        </div>
    `;
}

// Add this function to check for promotions
async function checkForPromotions() {
    try {
        const response = await fetch('/api/products/near-expiry?days=3');
        const expiringItems = await response.json();
        
        if (expiringItems.length > 0) {
            // Show quick promotions section
            document.getElementById('quickPromotions').style.display = 'block';
            
            // Take the most urgent item (nearest expiry)
            const urgentItem = expiringItems.sort((a, b) => a.days_remaining - b.days_remaining)[0];
            
            // Calculate suggested discount based on urgency
            let suggestedDiscount = 10;
            if (urgentItem.days_remaining <= 1) suggestedDiscount = 40;
            else if (urgentItem.days_remaining <= 3) suggestedDiscount = 30;
            else if (urgentItem.days_remaining <= 7) suggestedDiscount = 20;
            
            // Update suggestion
            document.getElementById('promoSuggestion').innerHTML = `
                <p><strong>Near-Expiry Alert!</strong></p>
                <p>${urgentItem.name} expires in ${Math.floor(urgentItem.days_remaining)} days</p>
                <p>Suggested: ${suggestedDiscount}% discount to clear stock</p>
                <p>Barcode: <strong>${urgentItem.barcode}</strong></p>
            `;
            
            // Show apply button
            const applyBtn = document.getElementById('applyPromoSuggestion');
            applyBtn.style.display = 'flex';
            applyBtn.onclick = () => {
                barcodeInput.value = urgentItem.barcode;
                fetchProductBtn.click();
                setTimeout(() => {
                    document.querySelector('input[name="discountType"][value="percent"]').checked = true;
                    discountValueInput.value = suggestedDiscount;
                    applyDiscountBtn.click();
                    alert(`Applied ${suggestedDiscount}% discount for ${urgentItem.name}!`);
                }, 500);
            };
        }
    } catch (error) {
        console.error('Error checking promotions:', error);
    }
}

// Call this function in DOMContentLoaded
document.addEventListener('DOMContentLoaded', async function() {
    // ... existing code ...
    
    // Check for promotions on page load
    checkForPromotions();
    
    // ... rest of the code ...
});

// ---------- BILL GENERATION & PRINT ----------
async function generateBillPreview() {
    if (cart.length === 0) {
        alert('Your cart is empty. Add products to generate a bill.');
        return;
    }
    
    const { subtotal, discount, total } = calculateTotals();
    const billNumber = 'BILL-' + Date.now().toString().slice(-6);
    const now = new Date();
    
    // Prepare order data for saving
    const orderData = {
        bill_number: billNumber,
        total_amount: subtotal,
        discount_amount: discount,
        final_amount: total,
        items: cart.map(item => ({
            product_id: item.id,
            quantity: item.quantity,
            price: item.price,
            item_total: item.price * item.quantity
        }))
    };
    
    try {
        // Show loading state
        generateBillBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving Bill...';
        generateBillBtn.disabled = true;
        
        // Save order to backend
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to save order');
        }
        
        const result = await response.json();
        console.log('Order saved:', result);
        
        // Build bill HTML
        let itemsHtml = '';
        cart.forEach(item => {
            itemsHtml += `
                <tr>
                    <td>${item.name}</td>
                    <td>${formatCurrency(item.price)}</td>
                    <td>${item.quantity}</td>
                    <td>${formatCurrency(item.price * item.quantity)}</td>
                </tr>
            `;
        });
        
        billPreviewContent.innerHTML = `
            <div class="bill-header">
                <h3>RETAILCHECK STORE</h3>
                <p>123 Main Street, Retail City | Phone: 9876543210</p>
                <p><strong>Bill No:</strong> ${billNumber} (Saved)</p>
                <p><strong>Date:</strong> ${now.toLocaleDateString('en-IN')} | <strong>Time:</strong> ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            
            <hr style="margin: 20px 0; border: 1px dashed #ccc;">
            
            <table class="bill-table">
                <thead>
                    <tr>
                        <th>Item Description</th>
                        <th>Unit Price</th>
                        <th>Qty</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
            
            <div class="bill-totals">
                <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                    <span>Subtotal:</span>
                    <span>${formatCurrency(subtotal)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin: 5px 0; color: #e74c3c;">
                    <span>Discount:</span>
                    <span>-${formatCurrency(discount)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin: 5px 0; font-size: 1.2em; font-weight: bold; border-top: 1px solid #333; padding-top: 10px;">
                    <span>Total Payable:</span>
                    <span>${formatCurrency(total)}</span>
                </div>
            </div>
            
            <div class="bill-footer">
                <p>Thank you for shopping with us!</p>
                <p>** This is a computer-generated bill **</p>
                <p><small>Order ID: ${result.orderId}</small></p>
            </div>
        `;
        
        // Show modal
        billModal.style.display = 'flex';
        
        // Clear cart after successful bill generation
        cart = [];
        appliedDiscount = { type: null, value: 0 };
        updateCartDisplay();
        calculateTotals();
        
        // Update quick-add panel with new sales data
        updateQuickAddPanel();
        
    } catch (error) {
        console.error('Error saving order:', error);
        alert('Failed to save the bill. Please try again.');
    } finally {
        // Reset button state
        generateBillBtn.innerHTML = '<i class="fas fa-print"></i> Generate & Print Bill';
        generateBillBtn.disabled = false;
    }
}

// ---------- EVENT LISTENERS ----------
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Check for auto-applied promotion
    const autoPromo = localStorage.getItem('auto_apply_promo');
    if (autoPromo) {
        const promo = JSON.parse(autoPromo);
        const now = new Date();
        const promoTime = new Date(promo.timestamp);
        
        // Only apply if within 5 minutes
        if ((now - promoTime) < 5 * 60 * 1000) {
            // Auto-fill the barcode and apply discount
            barcodeInput.value = promo.barcode;
            fetchProductBtn.click();
            
            // Set discount
            setTimeout(() => {
                document.querySelector('input[name="discountType"][value="percent"]').checked = true;
                discountValueInput.value = promo.discount;
                applyDiscountBtn.click();
                
                // Clear the auto-promo
                localStorage.removeItem('auto_apply_promo');
                
                // Show notification
                setTimeout(() => {
                    alert(`Auto-applied ${promo.discount}% discount for product ${promo.barcode}!`);
                }, 500);
            }, 1000);
        } else {
            localStorage.removeItem('auto_apply_promo');
        }
    }
    
    // Fetch products for quick-add panel
    await updateQuickAddPanel();
    
    // Product Fetch
    fetchProductBtn.addEventListener('click', async () => {
        const product = await fetchProductByBarcode(barcodeInput.value);
        if (product) displayProductDetails(product);
    });
    
    // Enter key in barcode input
    barcodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchProductBtn.click();
    });
    
    // Quantity controls
    decreaseQtyBtn.addEventListener('click', () => {
        quantityInput.value = Math.max(1, parseInt(quantityInput.value) - 1);
    });
    
    increaseQtyBtn.addEventListener('click', () => {
        quantityInput.value = parseInt(quantityInput.value) + 1;
    });
    
    // Add to cart
addToCartBtn.addEventListener('click', () => {
    const quantity = parseInt(quantityInput.value);
    if (quantity < 1) {
        alert('Quantity must be at least 1.');
        return;
    }
    
    if (currentProduct) {
        addProductToCart(currentProduct, quantity);
        productDetails.style.display = 'none';
        currentProduct = null; // Clear current product after adding
    } else {
        alert('Please fetch a product first.');
    }
});
    
    // Discount
    applyDiscountBtn.addEventListener('click', applyDiscount);
    clearDiscountBtn.addEventListener('click', clearDiscount);
    discountValueInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') applyDiscount();
    });
    
    // Cart controls
    clearCartBtn.addEventListener('click', () => {
        if (cart.length === 0) return;
        if (confirm('Are you sure you want to clear the cart? This cannot be undone.')) {
            cart = [];
            appliedDiscount = { type: null, value: 0 };
            updateCartDisplay();
            calculateTotals();
            billInsight.innerHTML = '';
        }
    });
    
    // Bill generation
    generateBillBtn.addEventListener('click', generateBillPreview);
    
    // Modal controls - FIXED VERSION
    printBillBtn.addEventListener('click', printBill);
    closeBillBtn.addEventListener('click', () => {
        billModal.style.display = 'none';
    });
    closeModalBtn.addEventListener('click', () => {
        billModal.style.display = 'none';
    });
        
    // Close modal when clicking outside - FIXED
    billModal.addEventListener('click', (e) => {
        if (e.target === billModal) {
            billModal.style.display = 'none';
        }
    });
    
    // Initial calculation
    calculateTotals();
});