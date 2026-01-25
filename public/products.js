// ============================================
// PRODUCT MANAGEMENT
// ============================================

let products = [];
let currentEditProduct = null;
let selectedProducts = new Set();

// ---------- DOM ELEMENTS ----------
const currentDateTime = document.getElementById('currentDateTime');
const newBarcodeInput = document.getElementById('newBarcode');
const newNameInput = document.getElementById('newName');
const newPriceInput = document.getElementById('newPrice');
const newExpiryDateInput = document.getElementById('newExpiryDate');
const addProductBtn = document.getElementById('addProductBtn');
const clearFormBtn = document.getElementById('clearFormBtn');
const addProductMessage = document.getElementById('addProductMessage');
const productSearchInput = document.getElementById('productSearch');
const productsTable = document.getElementById('productsTable');
const productCount = document.getElementById('productCount');
const refreshProductsBtn = document.getElementById('refreshProducts');
const editProductModal = document.getElementById('editProductModal');
const editBarcodeInput = document.getElementById('editBarcode');
const editNameInput = document.getElementById('editName');
const editPriceInput = document.getElementById('editPrice');
const editExpiryDateInput = document.getElementById('editExpiryDate');
const updateProductBtn = document.getElementById('updateProductBtn');
const deleteProductBtn = document.getElementById('deleteProductBtn');
const closeEditModalBtn = document.getElementById('closeEditModalBtn');
const editProductMessage = document.getElementById('editProductMessage');
const closeEditModal = document.querySelector('#editProductModal .close-modal');
const expiryFilter = document.getElementById('expiryFilter');

// Bulk elements
const bulkExpiryModal = document.getElementById('bulkExpiryModal');
const bulkExpiryDate = document.getElementById('bulkExpiryDate');
const bulkProductsList = document.getElementById('bulkProductsList');
const bulkUpdateMessage = document.getElementById('bulkUpdateMessage');

// ---------- HELPERS ----------
function updateDateTime() {
    const now = new Date();
    currentDateTime.textContent = now.toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showMessage(el, msg, type = 'success') {
    el.textContent = msg;
    el.className = `message ${type}`;
    el.style.display = 'block';
    if (type === 'success') setTimeout(() => el.style.display = 'none', 3000);
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

// ---------- LOAD PRODUCTS ----------
async function loadProducts(search = '', expiry = 'all') {
    const res = await fetch('/api/products');
    products = await res.json();

    let filtered = products;

    if (search) {
        const t = search.toLowerCase();
        filtered = filtered.filter(p =>
            p.barcode.toLowerCase().includes(t) ||
            p.name.toLowerCase().includes(t)
        );
    }

    if (expiry !== 'all') {
        filtered = filtered.filter(p => p.expiry_status === expiry);
    }

    renderProductsTable(filtered);
    productCount.textContent = `${filtered.length} of ${products.length} products`;
}

// ---------- RENDER TABLE ----------
function renderProductsTable(list) {
    productsTable.innerHTML = '';

    if (!list.length) {
        productsTable.innerHTML = `<tr><td colspan="7">No products found</td></tr>`;
        return;
    }

    list.forEach(p => {
        const tr = document.createElement('tr');
        tr.dataset.id = p.id;

        tr.innerHTML = `
            <td><strong>${p.barcode}</strong></td>
            <td>${p.name}</td>
            <td>₹${p.price.toFixed(2)}</td>
            <td>${p.expiry_date || 'N/A'}</td>
            <td><span class="status-badge status-${p.expiry_status}">${p.expiry_status}</span></td>
            <td>${formatDate(p.created_at)}</td>
            <td>
                <button class="btn-edit" data-id="${p.id}">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        `;

        productsTable.appendChild(tr);
    });

    addRowSelection();
    bindEditButtons();
}

// ---------- ROW SELECTION ----------
function addRowSelection() {
    document.querySelectorAll('#productsTable tr').forEach(row => {
        const id = parseInt(row.dataset.id);
        if (!id) return;

        row.addEventListener('click', e => {
            if (e.target.closest('.btn-edit')) return;
            row.classList.toggle('selected');
            row.classList.contains('selected')
                ? selectedProducts.add(id)
                : selectedProducts.delete(id);
            updateSelectedProductsList();
        });
    });
}

function updateSelectedProductsList() {
    if (!selectedProducts.size) {
        bulkProductsList.innerHTML = '<div>No products selected</div>';
        return;
    }

    bulkProductsList.innerHTML = [...selectedProducts].map(id => {
        const p = products.find(x => x.id === id);
        return `<div>${p.name} (${p.barcode})</div>`;
    }).join('');
}

// ---------- ADD PRODUCT ----------
async function addProduct() {
    const barcode = newBarcodeInput.value.trim();
    const name = newNameInput.value.trim();
    const price = parseFloat(newPriceInput.value);
    const expiry = newExpiryDateInput.value || null;

    if (!barcode || !name || !price) {
        showMessage(addProductMessage, 'Invalid input', 'error');
        return;
    }

    await fetch('/api/products', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ barcode, name, price, expiry_date: expiry })
    });

    showMessage(addProductMessage, 'Product added');
    loadProducts();
    newBarcodeInput.value = newNameInput.value = newPriceInput.value = newExpiryDateInput.value = '';
}

// ---------- EDIT ----------
function bindEditButtons() {
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.onclick = () => openEditModal(parseInt(btn.dataset.id));
    });
}

function openEditModal(id) {
    currentEditProduct = products.find(p => p.id === id);
    if (!currentEditProduct) return;

    editBarcodeInput.value = currentEditProduct.barcode;
    editNameInput.value = currentEditProduct.name;
    editPriceInput.value = currentEditProduct.price;
    editExpiryDateInput.value = currentEditProduct.expiry_date || '';
    editProductModal.style.display = 'flex';
}

async function updateProduct() {
    await fetch(`/api/products/${currentEditProduct.id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            name: editNameInput.value,
            price: editPriceInput.value,
            expiry_date: editExpiryDateInput.value || null
        })
    });

    showMessage(editProductMessage, 'Updated');
    editProductModal.style.display = 'none';
    loadProducts();
}

async function deleteProduct() {
    if (!confirm('Delete product?')) return;

    await fetch(`/api/products/${currentEditProduct.id}`, { method: 'DELETE' });
    editProductModal.style.display = 'none';
    loadProducts();
}

// ---------- BULK UPDATE ----------
document.getElementById('bulkUpdateExpiry')?.addEventListener('click', () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    bulkExpiryDate.value = d.toISOString().split('T')[0];
    selectedProducts.clear();
    updateSelectedProductsList();
    bulkExpiryModal.style.display = 'flex';
});

document.getElementById('applyBulkUpdate')?.addEventListener('click', async () => {
    if (!selectedProducts.size) return;

    await Promise.all([...selectedProducts].map(id => {
        const p = products.find(x => x.id === id);
        return fetch(`/api/products/${id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                name: p.name,
                price: p.price,
                expiry_date: bulkExpiryDate.value
            })
        });
    }));

    bulkExpiryModal.style.display = 'none';
    loadProducts();
});

// ---------- EVENTS ----------
document.addEventListener('DOMContentLoaded', () => {
    updateDateTime();
    setInterval(updateDateTime, 60000);
    loadProducts();

    addProductBtn.onclick = addProduct;
    updateProductBtn.onclick = updateProduct;
    deleteProductBtn.onclick = deleteProduct;
    closeEditModalBtn.onclick = () => editProductModal.style.display = 'none';

    productSearchInput.oninput = e => loadProducts(e.target.value, expiryFilter.value);
    refreshProductsBtn.onclick = () => loadProducts();
    expiryFilter.onchange = e => loadProducts(productSearchInput.value, e.target.value);
});
