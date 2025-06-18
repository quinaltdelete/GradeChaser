import fs from 'fs';

// Read your original JSON data
const data = JSON.parse(fs.readFileSync('./server/climbsData/rawData/squamish-climbs.json', 'utf-8'));

// Zones you defined and want to use
const validZones = [
  "Seal Cove",
  "Murrin Park",
  "Shannon Falls",
  "The Malamute",
  "Stawamus Chief",
  "Slhanay",
  "Crumpit Woods",
  "Paradise Valley",
  "Brohm Lake",
  "Cheakamus Canyon",
  "Alice Lake",
  "Coho Park",
  "Comic Rocks",
  "Covid Crag",
  "Gondola Area",
  "Gonzales Creek",
  "Highlander",
  "Mamquam FSR",
  "Mt. Habrich",
  "Neverland",
  "New Delhi Cliff",
  "Paradise Valley bouldering",
  "Powerline Boulders",
  "Pox Wall / Disaster Response Area",
  "Rampage Rock",
  "The Sanctuary",
  "Sky Pilot",
  "The Smoke Bluffs",
  "Squamish Ice & Mixed",
  "Squamish Valley",
  "The Valley of Shaddai"
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
          area: "Squamish",
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
fs.writeFileSync('cleaned-squamish-climbs.json', JSON.stringify(flattened, null, 2));
console.log('Cleaned JSON saved to cleaned-squamish-climbs.json');
