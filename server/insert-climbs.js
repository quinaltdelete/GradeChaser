// insert-climbs.js
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Connect using DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, 
  },
});

async function main() {
  try {
    const filePath = path.join(__dirname, 'climbsData/cleanedData/cleaned-rocklands-climbs.json');

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}
    const jsonData = fs.readFileSync(filePath, 'utf-8');
    const climbs = JSON.parse(jsonData);

    for (const climb of climbs) {
      // Pull 'zone' and call it sub_area; pull 'vGrade' and call it book_grade
      const { name, area, zone: sub_area, vGrade: book_grade } = climb;
      const country = "South Africa";
    
      await pool.query(
        `INSERT INTO routes (name, area, sub_area, country, book_grade)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name) DO NOTHING;`,
        [name, area, sub_area, country, book_grade]
      );
    }    

    console.log('All climbs inserted successfully!');
  } catch (err) {
    console.error('Error inserting climbs:', err);
  } finally {
    await pool.end();
  }
}

main();
