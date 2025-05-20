import fs from 'fs';

// Read your original JSON data
const data = JSON.parse(fs.readFileSync('./server/climbsData/rawData/tuolumne-climbs.json', 'utf-8'));

// Zones you defined and want to use
const validZones = [
  "Tenaya West Boulders",
  "Tank Boulder",
  "Yosemite Creek",
  "Sunrise Boulder",
  "Tenaya East Boulders",
  "White Mountain West Side Boulder Field",
  "May Lake - Battle Tanks",
  "Pennyroyal Boulders",
  "Puppy Boulders",
  "Pywiack Boulders",
  "Raisin Creek",
  "Ridge Top Boulders",
  "Knobs, The",
  "Medlicott Boulders",
  "Olmsted Canyon Boulders",
  "Olmsted Point Boulders",
  "Tenaya Lake Boulders",
  "Cathedral Boulders",
  "Drug Dome Boulders",
  "Drug Dome Trees",
  "Gunks, The",
  "Kitty Boulders",
  "Campground Boulder 1"
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
          area: "Tuolumne",
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
fs.writeFileSync('cleaned-tuolumne-climbs.json', JSON.stringify(flattened, null, 2));
console.log('Cleaned JSON saved to cleaned-tuolumne-climbs.json');
