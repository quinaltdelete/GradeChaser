import fs from 'fs';

// Read your original JSON data
const data = JSON.parse(fs.readFileSync('buttermilk-climbs.json', 'utf-8'));

// Zones you defined and want to use
const validZones = [
  "Buttermilks Main", 
  "Dale's Camp", 
  "Bardini", 
  "Pollen Grains", 
  "Beehive",
  "Checkerboard",
  "Sherman Acres",
  "Hall of Mirrors",
  "Get Carter Boulder",
  "Solitaire Boulder",
  "Sexy Bloc, The",
  "Possibly Disasterous",
  "Heaven",
  "Painted Cave Area",
  "Glass House, The"
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
      flattened.push({
        name: climb.name,
        area: "Bishop",
        zone: currentZone || "Other",
        vGrade: climb.grades?.vscale || "–"
      });
    });
  }

  if (node.children) {
    node.children.forEach(child => extractClimbs(child, currentZone));
  }
}

// Start extraction from root area
extractClimbs(data.data.area);

// Save to file
fs.writeFileSync('cleaned-buttermilk-climbs.json', JSON.stringify(flattened, null, 2));
console.log('Cleaned JSON saved to cleaned-buttermilk-climbs.json');
