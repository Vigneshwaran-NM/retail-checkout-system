const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve frontend files

// Database setup
const dbPath = path.join(__dirname, 'data', 'retail.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database at', dbPath);
    }
});

// Basic health check route
app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

// ---------- API ROUTES ----------

// 1. Get all products
app.get('/api/products', (req, res) => {
    const sql = `SELECT *, 
                CASE 
                    WHEN expiry_date IS NULL THEN 'non-perishable'
                    WHEN julianday(expiry_date) - julianday('now') < 0 THEN 'expired'
                    WHEN julianday(expiry_date) - julianday('now') <= 7 THEN 'urgent'
                    WHEN julianday(expiry_date) - julianday('now') <= 30 THEN 'warning'
                    ELSE 'ok'
                END as expiry_status
                FROM products ORDER BY name`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// 2. Get single product by barcode
app.get('/api/products/:barcode', (req, res) => {
    const sql = `SELECT * FROM products WHERE barcode = ?`;
    db.get(sql, [req.params.barcode], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Product not found' });
            return;
        }
        res.json(row);
    });
});

// 3. Create a new order (bill)
app.post('/api/orders', (req, res) => {
    const { bill_number, total_amount, discount_amount, final_amount, items } = req.body;
    
    // Validate required fields
    if (!bill_number || !total_amount || !final_amount || !items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Start a database transaction
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Insert order
        const orderSql = `INSERT INTO orders (bill_number, total_amount, discount_amount, final_amount) VALUES (?, ?, ?, ?)`;
        db.run(orderSql, [bill_number, total_amount, discount_amount, final_amount], function(err) {
            if (err) {
                db.run('ROLLBACK');
                res.status(500).json({ error: err.message });
                return;
            }
            
            const orderId = this.lastID;
            let itemsProcessed = 0;
            
            // Insert each order item
            items.forEach(item => {
                const itemSql = `INSERT INTO order_items (order_id, product_id, quantity, price_at_time, item_total) 
                                 VALUES (?, ?, ?, ?, ?)`;
                db.run(itemSql, [orderId, item.product_id, item.quantity, item.price, item.item_total], (err) => {
                    if (err) {
                        console.error('Error inserting order item:', err);
                    }
                    
                    itemsProcessed++;
                    if (itemsProcessed === items.length) {
                        // All items processed, commit transaction
                        db.run('COMMIT', (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                res.status(500).json({ error: err.message });
                                return;
                            }
                            res.json({ 
                                success: true, 
                                orderId: orderId,
                                bill_number: bill_number 
                            });
                        });
                    }
                });
            });
        });
    });
});

// 4. Get all orders for dashboard
app.get('/api/orders', (req, res) => {
    const { start_date, end_date } = req.query;
    
    let sql = `
        SELECT 
            o.id, o.bill_number, o.total_amount, o.discount_amount, 
            o.final_amount, o.created_at,
            COUNT(oi.id) as item_count
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
    `;
    
    const params = [];
    
    if (start_date && end_date) {
        sql += ` WHERE date(o.created_at) BETWEEN date(?) AND date(?)`;
        params.push(start_date, end_date);
    }
    
    sql += ` GROUP BY o.id ORDER BY o.created_at DESC LIMIT 50`;
    
    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// 5. Get daily sales summary
app.get('/api/sales/daily-summary', (req, res) => {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const sql = `
        SELECT 
            COUNT(DISTINCT o.id) as total_bills,
            SUM(o.final_amount) as total_sales,
            SUM(o.discount_amount) as total_discount,
            COUNT(oi.id) as total_items_sold,
            MIN(o.created_at) as first_sale_time,
            MAX(o.created_at) as last_sale_time
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE date(o.created_at) = date(?)
    `;
    
    db.get(sql, [targetDate], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // Get best-selling item for the day
        const bestSellerSql = `
            SELECT 
                p.name,
                SUM(oi.quantity) as total_quantity,
                SUM(oi.item_total) as total_value
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            JOIN orders o ON oi.order_id = o.id
            WHERE date(o.created_at) = date(?)
            GROUP BY p.id
            ORDER BY total_quantity DESC
            LIMIT 1
        `;
        
        db.get(bestSellerSql, [targetDate], (err, bestSeller) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            res.json({
                date: targetDate,
                summary: row || {
                    total_bills: 0,
                    total_sales: 0,
                    total_discount: 0,
                    total_items_sold: 0
                },
                best_seller: bestSeller || null
            });
        });
    });
});

// 6. Get sales trend data
app.get('/api/sales/trend', (req, res) => {
    const { days = 7 } = req.query;
    
    const sql = `
        SELECT 
            date(o.created_at) as sale_date,
            COUNT(DISTINCT o.id) as bill_count,
            SUM(o.final_amount) as total_sales,
            SUM(o.discount_amount) as total_discount
        FROM orders o
        WHERE date(o.created_at) >= date('now', ? || ' days')
        GROUP BY date(o.created_at)
        ORDER BY sale_date
    `;
    
    db.all(sql, [`-${days}`], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// 7. Get item-wise sales data
app.get('/api/sales/item-wise', (req, res) => {
    const { limit = 10 } = req.query;
    
    const sql = `
        SELECT 
            p.name,
            p.barcode,
            SUM(oi.quantity) as total_quantity,
            SUM(oi.item_total) as total_value,
            COUNT(DISTINCT o.id) as times_ordered
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN orders o ON oi.order_id = o.id
        GROUP BY p.id
        ORDER BY total_quantity DESC
        LIMIT ?
    `;
    
    db.all(sql, [limit], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// 8. Add new product (for product management)
app.post('/api/products', (req, res) => {
    const { barcode, name, price, expiry_date } = req.body;
    
    if (!barcode || !name || !price) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const sql = `INSERT INTO products (barcode, name, price, expiry_date) VALUES (?, ?, ?, ?)`;
    db.run(sql, [barcode, name, price, expiry_date || null], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Barcode already exists' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ 
            success: true, 
            id: this.lastID,
            message: 'Product added successfully'
        });
    });
});

// 9. Update product
app.put('/api/products/:id', (req, res) => {
    const { name, price, expiry_date } = req.body;
    const productId = req.params.id;
    
    if (!name || !price) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const sql = `UPDATE products SET name = ?, price = ?, expiry_date = ? WHERE id = ?`;
    db.run(sql, [name, price, expiry_date || null, productId], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({ 
            success: true, 
            message: 'Product updated successfully'
        });
    });
});

// 10. Delete product
app.delete('/api/products/:id', (req, res) => {
    const productId = req.params.id;
    
    // Check if product exists in any order
    const checkSql = `SELECT COUNT(*) as count FROM order_items WHERE product_id = ?`;
    db.get(checkSql, [productId], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (row.count > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete product. It exists in order history.' 
            });
        }
        
        // Delete product
        const deleteSql = `DELETE FROM products WHERE id = ?`;
        db.run(deleteSql, [productId], function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Product not found' });
            }
            res.json({ 
                success: true, 
                message: 'Product deleted successfully'
            });
        });
    });
});

// 11. Get near-expiry products
app.get('/api/products/near-expiry', (req, res) => {
    const { days = 7 } = req.query;
    
    const sql = `
        SELECT 
            p.id,
            p.barcode,
            p.name,
            p.price,
            p.expiry_date,
            julianday(p.expiry_date) - julianday('now') as days_remaining,
            p.is_near_expiry,
            p.promo_suggested
        FROM products p
        WHERE p.expiry_date IS NOT NULL 
        AND julianday(p.expiry_date) - julianday('now') BETWEEN 0 AND ?
        ORDER BY p.expiry_date ASC
    `;
    
    db.all(sql, [days], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // Update is_near_expiry flag
        rows.forEach(row => {
            if (!row.is_near_expiry) {
                db.run(`UPDATE products SET is_near_expiry = 1 WHERE id = ?`, [row.id]);
            }
        });
        
        res.json(rows);
    });
});

// 12. Get promo suggestions for near-expiry products
app.get('/api/promotions/suggestions', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    
    const sql = `
        SELECT 
            p.id,
            p.barcode,
            p.name,
            p.price,
            p.expiry_date,
            julianday(p.expiry_date) - julianday('now') as days_remaining,
            oi.total_sold
        FROM products p
        LEFT JOIN (
            SELECT product_id, SUM(quantity) as total_sold
            FROM order_items
            GROUP BY product_id
        ) oi ON p.id = oi.product_id
        WHERE p.expiry_date IS NOT NULL 
        AND julianday(p.expiry_date) - julianday('now') BETWEEN 0 AND 30
        ORDER BY p.expiry_date ASC
        LIMIT 10
    `;
    
    db.all(sql, [], (err, products) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        const suggestions = products.map(product => {
            const daysLeft = Math.floor(product.days_remaining);
            let promoType, promoDetails, discount;
            
            if (daysLeft <= 3) {
                // Urgent: 30% off
                promoType = 'urgent';
                discount = 30;
                promoDetails = {
                    type: 'percentage_discount',
                    value: discount,
                    description: `Urgent clearance! ${discount}% off (expires in ${daysLeft} days)`,
                    sticker_text: `FLASH SALE!\n${product.name}\n${discount}% OFF\nExp: ${product.expiry_date}`
                };
            } else if (daysLeft <= 7) {
                // Moderate: 20% off or bundle
                promoType = 'moderate';
                discount = 20;
                promoDetails = {
                    type: 'percentage_discount',
                    value: discount,
                    description: `Clearance sale! ${discount}% off (expires in ${daysLeft} days)`,
                    sticker_text: `CLEARANCE\n${product.name}\n${discount}% OFF\nExp: ${product.expiry_date}`
                };
            } else if (daysLeft <= 14) {
                // Early warning: 10% off
                promoType = 'early';
                discount = 10;
                promoDetails = {
                    type: 'percentage_discount',
                    value: discount,
                    description: `Early bird offer! ${discount}% off (expires in ${daysLeft} days)`,
                    sticker_text: `SPECIAL OFFER\n${product.name}\n${discount}% OFF\nExp: ${product.expiry_date}`
                };
            } else {
                // Bundle suggestion for slow-moving items
                const soldCount = product.total_sold || 0;
                if (soldCount < 10) {
                    promoType = 'bundle';
                    promoDetails = {
                        type: 'bundle_offer',
                        value: 'buy_2_get_1',
                        description: `Slow moving stock! Suggest: Buy 2 Get 1 at 20% off`,
                        sticker_text: `BUNDLE DEAL\n${product.name}\nBuy 2 Get 1\nat 20% OFF`
                    };
                } else {
                    promoType = 'none';
                    promoDetails = null;
                }
            }
            
            return {
                ...product,
                days_remaining: daysLeft,
                promo_type: promoType,
                promo_details: promoDetails
            };
        }).filter(item => item.promo_details !== null);
        
        res.json(suggestions);
    });
});

// 13. Generate promotion sticker PDF
app.get('/api/promotions/sticker/:productId', (req, res) => {
    const productId = req.params.productId;
    
    const sql = `SELECT * FROM products WHERE id = ?`;
    db.get(sql, [productId], (err, product) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (!product) {
            res.status(404).json({ error: 'Product not found' });
            return;
        }
        
        // Simple HTML sticker for now (could be PDF in production)
        const stickerHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Promotion Sticker - ${product.name}</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        padding: 20px;
                        width: 400px;
                        margin: 0 auto;
                    }
                    .sticker {
                        border: 3px solid #e74c3c;
                        border-radius: 10px;
                        padding: 20px;
                        text-align: center;
                        background: linear-gradient(135deg, #fff5f5, #ffeaa7);
                    }
                    .urgency-badge {
                        background: #e74c3c;
                        color: white;
                        padding: 5px 15px;
                        border-radius: 20px;
                        font-weight: bold;
                        display: inline-block;
                        margin-bottom: 15px;
                    }
                    .product-name {
                        font-size: 24px;
                        font-weight: bold;
                        color: #2c3e50;
                        margin: 10px 0;
                    }
                    .promo-text {
                        font-size: 32px;
                        color: #c0392b;
                        font-weight: bold;
                        margin: 15px 0;
                    }
                    .expiry {
                        color: #7f8c8d;
                        font-size: 14px;
                        margin-top: 10px;
                        border-top: 1px dashed #ccc;
                        padding-top: 10px;
                    }
                    .barcode {
                        margin-top: 20px;
                        padding: 10px;
                        background: white;
                        display: inline-block;
                    }
                    .instructions {
                        font-size: 12px;
                        color: #666;
                        margin-top: 20px;
                        font-style: italic;
                    }
                </style>
            </head>
            <body>
                <div class="sticker">
                    <div class="urgency-badge">URGENT PROMOTION</div>
                    <div class="product-name">${product.name}</div>
                    <div class="promo-text">30% OFF</div>
                    <div>Original: ₹${product.price.toFixed(2)}</div>
                    <div>Promo: ₹${(product.price * 0.7).toFixed(2)}</div>
                    <div class="expiry">
                        Expires: ${product.expiry_date || 'N/A'}<br>
                        Scan barcode at checkout
                    </div>
                    <div class="barcode">
                        <strong>[ ${product.barcode} ]</strong>
                    </div>
                    <div class="instructions">
                        Place this sticker on shelf near product<br>
                        Promotion valid until expiry date
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
        `;
        
        res.setHeader('Content-Type', 'text/html');
        res.send(stickerHtml);
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});