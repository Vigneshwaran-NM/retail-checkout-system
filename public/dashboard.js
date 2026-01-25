// ============================================
// DASHBOARD - SALES ANALYTICS
// ============================================

// Global variables
let salesTrendChart = null;
let topItemsChart = null;
let currentStartDate = '';
let currentEndDate = '';

// DOM Elements
const currentDateTime = document.getElementById('currentDateTime');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const applyDateRangeBtn = document.getElementById('applyDateRange');
const resetDateRangeBtn = document.getElementById('resetDateRange');
const quickDateButtons = document.querySelectorAll('.quick-date-buttons .btn-small');
const refreshDataBtn = document.getElementById('refreshData');

// Summary cards
const totalSalesEl = document.getElementById('totalSales');
const totalBillsEl = document.getElementById('totalBills');
const totalDiscountEl = document.getElementById('totalDiscount');
const totalItemsEl = document.getElementById('totalItems');

// Charts
const salesTrendCanvas = document.getElementById('salesTrendChart');
const topItemsCanvas = document.getElementById('topItemsChart');

// Table
const recentBillsTable = document.getElementById('recentBillsTable');
const summaryInfo = document.getElementById('summaryInfo');

function formatCurrency(amount) {
    return '₹' + new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function updateDateTime() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
    };
    currentDateTime.textContent = now.toLocaleDateString('en-IN', options);
}

function setDefaultDateRange() {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    startDateInput.value = sevenDaysAgo.toISOString().split('T')[0];
    endDateInput.value = today.toISOString().split('T')[0];
    
    currentStartDate = startDateInput.value;
    currentEndDate = endDateInput.value;
}

// ---------- DATA FETCHING ----------
async function fetchDashboardData() {
    try {
        // Show loading state
        refreshDataBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        
        // Fetch all data in parallel
        const [dailySummary, salesTrend, itemWise, recentOrders] = await Promise.all([
            fetchDailySummary(),
            fetchSalesTrend(),
            fetchItemWiseSales(),
            fetchRecentOrders()
        ]);
        
        // Update UI with fetched data
        updateSummaryCards(dailySummary);
        updateSalesTrendChart(salesTrend);
        updateTopItemsChart(itemWise);
        updateRecentBillsTable(recentOrders);
        
        // Update summary info
        summaryInfo.textContent = `Showing ${recentOrders.length} bills from ${formatDate(currentStartDate)} to ${formatDate(currentEndDate)}`;
        
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        alert('Failed to load dashboard data. Please try again.');
    } finally {
        refreshDataBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Data';
    }
}

async function fetchDailySummary() {
    // For dashboard, we'll get summary for the entire date range
    const response = await fetch(`/api/orders?start_date=${currentStartDate}&end_date=${currentEndDate}`);
    const orders = await response.json();
    
    // Calculate totals from orders
    const summary = {
        total_bills: orders.length,
        total_sales: orders.reduce((sum, order) => sum + order.final_amount, 0),
        total_discount: orders.reduce((sum, order) => sum + order.discount_amount, 0),
        total_items_sold: orders.reduce((sum, order) => sum + order.item_count, 0)
    };
    
    return summary;
}

async function fetchSalesTrend() {
    // Calculate days difference for trend
    const start = new Date(currentStartDate);
    const end = new Date(currentEndDate);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const days = Math.min(daysDiff, 30); // Max 30 days for trend
    
    const response = await fetch(`/api/sales/trend?days=${days}`);
    return await response.json();
}

async function fetchItemWiseSales() {
    const response = await fetch(`/api/sales/item-wise?limit=8`);
    return await response.json();
}

async function fetchRecentOrders() {
    const response = await fetch(`/api/orders?start_date=${currentStartDate}&end_date=${currentEndDate}`);
    return await response.json();
}

// ---------- UI UPDATES ----------
function updateSummaryCards(summary) {
    totalSalesEl.textContent = formatCurrency(summary.total_sales);
    totalBillsEl.textContent = summary.total_bills;
    totalDiscountEl.textContent = formatCurrency(summary.total_discount);
    totalItemsEl.textContent = summary.total_items_sold;
}

function updateSalesTrendChart(trendData) {
    const ctx = salesTrendCanvas.getContext('2d');
    
    // Destroy existing chart if exists
    if (salesTrendChart) {
        salesTrendChart.destroy();
    }
    
    // Prepare data
    const labels = trendData.map(item => {
        const date = new Date(item.sale_date);
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    });
    
    const salesData = trendData.map(item => item.total_sales || 0);
    const billData = trendData.map(item => item.bill_count || 0);
    
    // Create gradient for sales line
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(52, 152, 219, 0.4)');
    gradient.addColorStop(1, 'rgba(52, 152, 219, 0.05)');
    
    // Create chart
    salesTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Sales Amount (₹)',
                    data: salesData,
                    borderColor: '#3498db',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#3498db',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                },
                {
                    label: 'Number of Bills',
                    data: billData,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4,
                    pointBackgroundColor: '#e74c3c',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            family: "'Poppins', sans-serif",
                            size: 13,
                            weight: '600'
                        },
                        padding: 20,
                        usePointStyle: true,
                        boxWidth: 10,
                        boxHeight: 10
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(44, 62, 80, 0.95)',
                    titleFont: {
                        family: "'Poppins', sans-serif",
                        size: 13,
                        weight: '600'
                    },
                    bodyFont: {
                        family: "'Poppins', sans-serif",
                        size: 13
                    },
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label.includes('Sales')) {
                                return label + ': ₹' + context.raw.toLocaleString('en-IN');
                            }
                            return label + ': ' + context.raw;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false,
                        drawTicks: false
                    },
                    ticks: {
                        font: {
                            family: "'Poppins', sans-serif",
                            size: 12,
                            weight: '500'
                        },
                        color: '#5d6d7e',
                        padding: 10
                    },
                    title: {
                        display: true,
                        text: 'Date',
                        color: '#34495e',
                        font: {
                            family: "'Poppins', sans-serif",
                            size: 13,
                            weight: '700'
                        },
                        padding: { top: 10 }
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            family: "'Poppins', sans-serif",
                            size: 12,
                            weight: '500'
                        },
                        color: '#5d6d7e',
                        padding: 10,
                        callback: function(value) {
                            if (value >= 1000) return '₹' + (value/1000).toFixed(0) + 'k';
                            return '₹' + value;
                        }
                    },
                    title: {
                        display: true,
                        text: 'Sales Amount (₹)',
                        color: '#3498db',
                        font: {
                            family: "'Poppins', sans-serif",
                            size: 13,
                            weight: '700'
                        },
                        padding: { bottom: 10 }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    grid: {
                        drawOnChartArea: false,
                    },
                    ticks: {
                        font: {
                            family: "'Poppins', sans-serif",
                            size: 12,
                            weight: '500'
                        },
                        color: '#e74c3c',
                        padding: 10
                    },
                    title: {
                        display: true,
                        text: 'Number of Bills',
                        color: '#e74c3c',
                        font: {
                            family: "'Poppins', sans-serif",
                            size: 13,
                            weight: '700'
                        },
                        padding: { bottom: 10 }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            elements: {
                line: {
                    tension: 0.4
                }
            }
        }
    });
}

function updateTopItemsChart(itemData) {
    const ctx = topItemsCanvas.getContext('2d');
    
    // Destroy existing chart if exists
    if (topItemsChart) {
        topItemsChart.destroy();
    }
    
    // Prepare data (limit to 8 items for readability)
    const displayData = itemData.slice(0, 8);
    const labels = displayData.map(item => {
        // Shorten long product names
        return item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name;
    });
    
    const quantities = displayData.map(item => item.total_quantity || 0);
    
    // Create gradient colors
    const colors = [
        'rgba(52, 152, 219, 0.8)',   // Blue
        'rgba(46, 204, 113, 0.8)',   // Green
        'rgba(155, 89, 182, 0.8)',   // Purple
        'rgba(241, 196, 15, 0.8)',   // Yellow
        'rgba(230, 126, 34, 0.8)',   // Orange
        'rgba(231, 76, 60, 0.8)',    // Red
        'rgba(149, 165, 166, 0.8)',  // Gray
        'rgba(52, 73, 94, 0.8)'      // Dark Blue
    ];
    
    const borderColors = colors.map(color => color.replace('0.8', '1'));
    
    // Create chart
    topItemsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Quantity Sold',
                data: quantities,
                backgroundColor: colors,
                borderColor: borderColors,
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(44, 62, 80, 0.95)',
                    titleFont: {
                        family: "'Poppins', sans-serif",
                        size: 13,
                        weight: '600'
                    },
                    bodyFont: {
                        family: "'Poppins', sans-serif",
                        size: 13
                    },
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            return `Sold: ${context.raw} units`;
                        },
                        afterLabel: function(context) {
                            const item = displayData[context.dataIndex];
                            return `Total Value: ₹${(item.total_value || 0).toLocaleString('en-IN')}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            family: "'Poppins', sans-serif",
                            size: 12,
                            weight: '600'
                        },
                        color: '#34495e',
                        maxRotation: 45,
                        padding: 10
                    },
                    title: {
                        display: true,
                        text: 'Products',
                        color: '#34495e',
                        font: {
                            family: "'Poppins', sans-serif",
                            size: 13,
                            weight: '700'
                        },
                        padding: { top: 10 }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            family: "'Poppins', sans-serif",
                            size: 12,
                            weight: '500'
                        },
                        color: '#5d6d7e',
                        padding: 10,
                        precision: 0,
                        callback: function(value) {
                            return value + ' units';
                        }
                    },
                    title: {
                        display: true,
                        text: 'Quantity Sold',
                        color: '#34495e',
                        font: {
                            family: "'Poppins', sans-serif",
                            size: 13,
                            weight: '700'
                        },
                        padding: { bottom: 10 }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            },
            elements: {
                bar: {
                    backgroundColor: function(context) {
                        const index = context.dataIndex;
                        return colors[index % colors.length];
                    }
                }
            }
        }
    });
}
// ---------- NEAR-EXPIRY PROMOTIONS ----------
async function loadPromotions() {
    try {
        const response = await fetch('/api/promotions/suggestions');
        const promotions = await response.json();
        
        updatePromotionsGrid(promotions);
        updatePromoStats(promotions);
        
    } catch (error) {
        console.error('Error loading promotions:', error);
        document.getElementById('promotionsGrid').innerHTML = `
            <div class="loading-promotions">
                <i class="fas fa-exclamation-circle"></i> Failed to load promotions
            </div>
        `;
    }
}

function updatePromotionsGrid(promotions) {
    const grid = document.getElementById('promotionsGrid');
    
    if (!promotions || promotions.length === 0) {
        grid.innerHTML = `
            <div class="loading-promotions">
                <i class="fas fa-check-circle"></i> No near-expiry items requiring promotions
            </div>
        `;
        return;
    }
    
    grid.innerHTML = '';
    
    promotions.forEach(promo => {
        const promoCard = document.createElement('div');
        promoCard.className = `promo-card ${promo.promo_type}`;
        
        const daysLeft = promo.days_remaining;
        const urgencyClass = daysLeft <= 3 ? 'urgent' : 
                           daysLeft <= 7 ? 'moderate' : 
                           daysLeft <= 14 ? 'early' : 'bundle';
        
        let discountValue = '';
        if (promo.promo_details && promo.promo_details.type === 'percentage_discount') {
            discountValue = `${promo.promo_details.value}% OFF`;
        } else if (promo.promo_details && promo.promo_details.type === 'bundle_offer') {
            discountValue = 'BUNDLE DEAL';
        }
        
        promoCard.innerHTML = `
            <div class="promo-badge">${promo.promo_type.toUpperCase()}</div>
            <div class="promo-content">
                <h4>${promo.name}</h4>
                <div class="expiry-info">
                    <i class="fas fa-calendar-times"></i>
                    <span>Expires in ${daysLeft} days (${promo.expiry_date})</span>
                </div>
                <div class="promo-details">
                    <p><strong>${promo.promo_details.description}</strong></p>
                    <p>Original Price: ₹${promo.price.toFixed(2)}</p>
                    ${promo.promo_details.type === 'percentage_discount' ? 
                        `<p>Promo Price: ₹${(promo.price * (1 - promo.promo_details.value/100)).toFixed(2)}</p>` : 
                        '<p>Bundle: Buy 2 Get 1 at 20% off</p>'
                    }
                    <p>Barcode: <strong>${promo.barcode}</strong></p>
                </div>
                <div class="promo-actions">
                    <button class="btn-small btn-primary apply-promo" data-barcode="${promo.barcode}" data-discount="${promo.promo_details.value || 20}">
                        <i class="fas fa-cart-plus"></i> Apply in Billing
                    </button>
                    <button class="btn-small btn-success print-sticker" data-product-id="${promo.id}">
                        <i class="fas fa-print"></i> Print Sticker
                    </button>
                </div>
            </div>
        `;
        
        grid.appendChild(promoCard);
    });
    
    // Add event listeners
    document.querySelectorAll('.apply-promo').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const barcode = e.target.closest('button').dataset.barcode;
            const discount = e.target.closest('button').dataset.discount;
            applyPromotionToBilling(barcode, discount);
        });
    });
    
    document.querySelectorAll('.print-sticker').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const productId = e.target.closest('button').dataset.productId;
            printPromotionSticker(productId);
        });
    });
}

function updatePromoStats(promotions) {
    const nearExpiryCount = promotions.length;
    const promoCount = promotions.filter(p => p.promo_details).length;
    
    // Calculate potential savings (sum of discount amounts)
    let potentialSavings = 0;
    promotions.forEach(promo => {
        if (promo.promo_details && promo.promo_details.type === 'percentage_discount') {
            const discountAmount = promo.price * (promo.promo_details.value / 100);
            potentialSavings += discountAmount;
        }
    });
    
    document.getElementById('nearExpiryCount').textContent = nearExpiryCount;
    document.getElementById('promoCount').textContent = promoCount;
    document.getElementById('potentialSavings').textContent = `₹${potentialSavings.toFixed(2)}`;
}

function applyPromotionToBilling(barcode, discount) {
    // Store in localStorage for billing page to pick up
    localStorage.setItem('auto_apply_promo', JSON.stringify({
        barcode: barcode,
        discount: discount,
        timestamp: new Date().toISOString()
    }));
    
    // Switch to billing page
    window.location.href = 'index.html';
    
    // Show notification
    alert(`Promotion will be applied when you add product ${barcode} to cart!`);
}

function printPromotionSticker(productId) {
    window.open(`/api/promotions/sticker/${productId}`, '_blank');
}

async function printAllStickers() {
    const response = await fetch('/api/promotions/suggestions');
    const promotions = await response.json();
    
    if (promotions.length === 0) {
        alert('No promotions available to print.');
        return;
    }
    
    // Print first 3 stickers (to avoid overwhelming)
    const toPrint = promotions.slice(0, 3);
    toPrint.forEach((promo, index) => {
        setTimeout(() => {
            printPromotionSticker(promo.id);
        }, index * 1000); // Stagger prints
    });
    
    alert(`Opening ${toPrint.length} sticker(s) for printing...`);
}

function updateRecentBillsTable(orders) {
    recentBillsTable.innerHTML = '';
    
    if (orders.length === 0) {
        recentBillsTable.innerHTML = `
            <tr>
                <td colspan="6" class="empty-data">No bills found for selected period.</td>
            </tr>
        `;
        return;
    }
    
    orders.forEach(order => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${order.bill_number}</strong></td>
            <td>${formatDateTime(order.created_at)}</td>
            <td>${order.item_count} items</td>
            <td>${formatCurrency(order.total_amount)}</td>
            <td>${formatCurrency(order.discount_amount)}</td>
            <td><strong>${formatCurrency(order.final_amount)}</strong></td>
        `;
        recentBillsTable.appendChild(row);
    });
}

// ---------- EVENT LISTENERS ----------
document.addEventListener('DOMContentLoaded', function() {
    // Initialize
    updateDateTime();
    setInterval(updateDateTime, 60000); // Update every minute
    
    loadPromotions();

    document.getElementById('refreshPromotions')?.addEventListener('click', loadPromotions);
    document.getElementById('generateAllStickers')?.addEventListener('click', printAllStickers);

    // Set default date range (last 7 days)
    setDefaultDateRange();
    // Load initial data
    fetchDashboardData();
    
    // Date range controls
    applyDateRangeBtn.addEventListener('click', () => {
        currentStartDate = startDateInput.value;
        currentEndDate = endDateInput.value;
        
        if (!currentStartDate || !currentEndDate) {
            alert('Please select both start and end dates.');
            return;
        }
        
        if (new Date(currentStartDate) > new Date(currentEndDate)) {
            alert('Start date cannot be after end date.');
            return;
        }
        
        fetchDashboardData();
    });
    
    resetDateRangeBtn.addEventListener('click', () => {
        setDefaultDateRange();
        fetchDashboardData();
    });
    
    // Quick date buttons
    quickDateButtons.forEach(button => {
        button.addEventListener('click', () => {
            const days = parseInt(button.dataset.days);
            const end = new Date();
            const start = new Date();
            start.setDate(end.getDate() - days + 1);
            
            startDateInput.value = start.toISOString().split('T')[0];
            endDateInput.value = end.toISOString().split('T')[0];
            
            currentStartDate = startDateInput.value;
            currentEndDate = endDateInput.value;
            
            fetchDashboardData();
        });
    });
    
    // Refresh button
    refreshDataBtn.addEventListener('click', fetchDashboardData);
    
    // Auto-refresh every 2 minutes
    setInterval(fetchDashboardData, 120000);
});