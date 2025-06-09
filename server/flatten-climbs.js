import fs from 'fs';

// Read your original JSON data
const data = JSON.parse(fs.readFileSync('./server/climbsData/rawData/hueco-climbs.json', 'utf-8'));

// Zones you defined and want to use
const validZones = [
  "West Mountain",
  "North Mountain",
  "East Spur",
  "East Mountain"
];

// Flatten the climbs recursively
const flattened = [];

// Recursive function to find climbs and match them to top-level zone
function extractClimbs(node, currentZone = null) {
  if (validZones.includes(node.area_name)) {
    currentZone = node.area_name;
  }

  if (node.climbs?.length) {
    node.climbs.forEach(climb => {
      if (climb.grades?.vscale !== null) {
        flattened.push({
          name: climb.name,
          area: "Hueco Tanks",
          zone: currentZone || "Other",
          vGrade: climb.grades?.vscale || "–"
        });
      }
    });
  }

  if (node.children) {
    node.children.forEach(child => extractClimbs(child, currentZone));
  }
}

// Start extraction from root area
extractClimbs(data.data.area);

// Save to file
fs.writeFileSync('cleaned-hueco-climbs.json', JSON.stringify(flattened, null, 2));
console.log('Cleaned JSON saved to cleaned-hueco-climbs.json');
