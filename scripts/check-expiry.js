const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'retail.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking for near-expiry products...');

const sql = `
    SELECT 
        p.id,
        p.name,
        p.expiry_date,
        julianday(p.expiry_date) - julianday('now') as days_remaining
    FROM products p
    WHERE p.expiry_date IS NOT NULL 
    AND julianday(p.expiry_date) - julianday('now') BETWEEN 0 AND 7
    ORDER BY p.expiry_date ASC
`;

db.all(sql, [], (err, products) => {
    if (err) {
        console.error('Error checking expiry:', err.message);
        db.close();
        return;
    }
    
    console.log(`Found ${products.length} products near expiry:`);
    
    products.forEach(product => {
        console.log(`  • ${product.name} expires in ${Math.floor(product.days_remaining)} days (${product.expiry_date})`);
        
        // Update near-expiry flag
        db.run(`UPDATE products SET is_near_expiry = 1 WHERE id = ?`, [product.id]);
    });
    
    if (products.length > 0) {
        console.log('\n🎯 RECOMMENDED ACTIONS:');
        console.log('1. Run promotions for urgent items (≤3 days)');
        console.log('2. Print shelf stickers for moderate items (4-7 days)');
        console.log('3. Consider bundling slow-moving items');
    } else {
        console.log('No products near expiry. Good job!');
    }
    
    db.close();
});