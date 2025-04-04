import 'dotenv/config';
import fs from 'fs';
import pkg from 'pg';
const { Pool } = pkg;

// Set up database connection
const pool = new Pool();

// Load \cleaned climbs data
const climbs = JSON.parse(fs.readFileSync('cleaned-buttermilk-climbs.json', 'utf-8'));

// Function to insert climbs into database
async function insertClimbs() {
  const queryText = `
    INSERT INTO routes (name, area, sub_area, country, book_grade)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (name) DO NOTHING
  `;

  for (const climb of climbs) {
    const values = [
      climb.name,
      climb.area,            
      climb.zone,            
      "USA",                 // defaulting USA for Bishop
      climb.vGrade           
    ];

    try {
      await pool.query(queryText, values);
      console.log(`Inserted: ${climb.name}`);
    } catch (err) {
      console.error(`Error inserting ${climb.name}:`, err);
    }
  }

  await pool.end();
  console.log('Done!');
}

insertClimbs();
