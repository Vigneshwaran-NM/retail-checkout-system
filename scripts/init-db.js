const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'retail.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database for initialization:', err.message);
    } else {
        console.log('Database opened for initialization.');
    }
});

// Create tables
const initQueries = [
    `CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode TEXT UNIQUE,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_number TEXT UNIQUE NOT NULL,
        total_amount REAL NOT NULL,
        discount_amount REAL DEFAULT 0,
        final_amount REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price_at_time REAL NOT NULL,
        item_total REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id)
    )`
];

db.serialize(() => {
    console.log('Creating tables...');
    initQueries.forEach((query) => {
        db.run(query, (err) => {
            if (err) {
                console.error('Error creating table:', err.message);
                console.error('Query:', query);
            } else {
                console.log('Table created/verified successfully.');
            }
        });
    });

    // Insert sample product data
    const sampleProducts = [
        { barcode: '1001', name: 'Premium Rice (1kg)', price: 65.00 },
        { barcode: '1002', name: 'Wheat Flour (1kg)', price: 40.00 },
        { barcode: '1003', name: 'Sunflower Oil (1L)', price: 180.00 },
        { barcode: '1004', name: 'Toothpaste (100g)', price: 55.00 },
        { barcode: '1005', name: 'Soap Bar', price: 30.00 },
        { barcode: '1006', name: 'Biscuits Pack', price: 20.00 },
        { barcode: '1007', name: 'Mineral Water (1L)', price: 25.00 },
        { barcode: '1008', name: 'Chocolate Bar', price: 50.00 },
        { barcode: '1009', name: 'Instant Noodles', price: 40.00 },
        { barcode: '1010', name: 'Dairy Milk (500ml)', price: 32.00 }
    ];

    const insertStmt = db.prepare(`INSERT OR IGNORE INTO products (barcode, name, price) VALUES (?, ?, ?)`);
    sampleProducts.forEach(product => {
        insertStmt.run([product.barcode, product.name, product.price], function(err) {
            if (err) {
                console.error('Error inserting product:', err.message);
            } else if (this.changes > 0) {
                console.log(`Inserted product: ${product.name}`);
            }
        });
    });
    insertStmt.finalize();

    console.log('Database initialization complete.');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
    });
});