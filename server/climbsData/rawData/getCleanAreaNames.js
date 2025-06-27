import fs from 'fs';
import path from 'path';

// Define paths
const rawDataPath = path.join(process.cwd(), 'server/climbsData/rawData/rocklands-climbs-vscales.json');
const outputFilePath = path.join(process.cwd(), 'server/climbsData/cleanedData/cleaned-rocklands-area-names.json');

// Read and parse the JSON data
const data = JSON.parse(fs.readFileSync(rawDataPath, 'utf-8'));

// Array to store second-level area names
const secondLevelAreas = [];

// Extract second-level area names from the `children` array
if (data?.data?.area?.children && Array.isArray(data.data.area.children)) {
  data.data.area.children.forEach((child) => {
    if (child.areaName) {
      secondLevelAreas.push(child.areaName); // Add the areaName directly
    } else {
      console.warn('Missing areaName for child:', child);
    }
  });
} else {
  console.error('Invalid or missing structure for data.data.area.children');
}

// Ensure the output directory exists
fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });

// Save the result to a file
fs.writeFileSync(outputFilePath, JSON.stringify(secondLevelAreas, null, 2));
console.log(`Cleaned JSON saved to ${outputFilePath}`);