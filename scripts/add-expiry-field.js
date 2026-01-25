const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'retail.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Database opened for adding expiry field.');
    }
});

// Add expiry_date field to products table
const queries = [
    `ALTER TABLE products ADD COLUMN expiry_date DATE`,
    `ALTER TABLE products ADD COLUMN is_near_expiry BOOLEAN DEFAULT 0`,
    `ALTER TABLE products ADD COLUMN promo_suggested BOOLEAN DEFAULT 0`
];

db.serialize(() => {
    console.log('Adding expiry-related fields to products table...');
    
    queries.forEach((query, index) => {
        db.run(query, (err) => {
            if (err) {
                // If column already exists, ignore the error
                if (!err.message.includes('duplicate column name')) {
                    console.error('Error executing query:', err.message);
                    console.error('Query:', query);
                } else {
                    console.log(`Column already exists or added successfully.`);
                }
            } else {
                console.log(`Query ${index + 1} executed successfully.`);
            }
        });
    });
    
    // Update some sample products with expiry dates (30-90 days from now)
    const updateStmt = db.prepare(`UPDATE products SET expiry_date = ? WHERE id = ?`);
    
    const today = new Date();
    const sampleExpiries = [
        { id: 1, days: 7 },   // Rice - expires in 7 days
        { id: 4, days: 15 },  // Toothpaste - expires in 15 days
        { id: 5, days: 30 },  // Soap - expires in 30 days
        { id: 7, days: 5 },   // Mineral Water - expires in 5 days
        { id: 10, days: 3 }   // Dairy Milk - expires in 3 days
    ];
    
    sampleExpiries.forEach(item => {
        const expiryDate = new Date(today);
        expiryDate.setDate(today.getDate() + item.days);
        const expiryStr = expiryDate.toISOString().split('T')[0];
        
        updateStmt.run([expiryStr, item.id], (err) => {
            if (err) {
                console.error('Error updating product expiry:', err.message);
            } else {
                console.log(`Updated product ${item.id} with expiry: ${expiryStr}`);
            }
        });
    });
    
    updateStmt.finalize();
    
    console.log('Database update complete.');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
    });
});